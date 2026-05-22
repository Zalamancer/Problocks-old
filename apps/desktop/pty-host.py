#!/usr/bin/env python3
"""
PTY Host — creates a real pseudo-terminal for shell interaction.
Communicates with the Electron main process via stdin/stdout JSON messages.
"""
import pty, os, sys, select, json, base64, signal, struct, fcntl, termios

shell = os.environ.get('SHELL', '/bin/zsh')
cwd = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~')
cols = int(sys.argv[2]) if len(sys.argv) > 2 else 80
rows = int(sys.argv[3]) if len(sys.argv) > 3 else 24

# Create PTY pair
master_fd, slave_fd = pty.openpty()

# Set initial window size
winsize = struct.pack('HHHH', rows, cols, 0, 0)
fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, winsize)

# Spawn shell with the slave as its controlling terminal
pid = os.fork()
if pid == 0:
    # Child — become session leader, attach to slave PTY
    os.setsid()
    os.close(master_fd)

    # Set slave as controlling terminal
    fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)

    os.dup2(slave_fd, 0)
    os.dup2(slave_fd, 1)
    os.dup2(slave_fd, 2)
    if slave_fd > 2:
        os.close(slave_fd)

    os.chdir(cwd)
    env = os.environ.copy()
    env['TERM'] = 'xterm-256color'
    env['COLORTERM'] = 'truecolor'
    os.execve(shell, [shell, '--login'], env)

# Parent — communicate between Electron (stdin/stdout) and PTY (master_fd)
os.close(slave_fd)

# Make master_fd non-blocking
import fcntl as f2
flags = f2.fcntl(master_fd, f2.F_GETFL)
f2.fcntl(master_fd, f2.F_SETFL, flags | os.O_NONBLOCK)

# Make stdin non-blocking
flags = f2.fcntl(sys.stdin.fileno(), f2.F_GETFL)
f2.fcntl(sys.stdin.fileno(), f2.F_SETFL, flags | os.O_NONBLOCK)

def send_msg(msg):
    sys.stdout.write(json.dumps(msg) + '\n')
    sys.stdout.flush()

send_msg({'type': 'ready'})

input_buffer = ''

def handle_sigchld(signum, frame):
    # Only exit if the MAIN shell process died, not its children
    try:
        wpid, status = os.waitpid(pid, os.WNOHANG)
        if wpid == pid:
            code = os.WEXITSTATUS(status) if os.WIFEXITED(status) else 1
            send_msg({'type': 'exit', 'code': code})
            sys.exit(0)
    except ChildProcessError:
        # pid already reaped
        send_msg({'type': 'exit', 'code': 0})
        sys.exit(0)
    except:
        pass

signal.signal(signal.SIGCHLD, handle_sigchld)

try:
    while True:
        try:
            rlist, _, _ = select.select([master_fd, sys.stdin.fileno()], [], [], 0.05)
        except (select.error, ValueError):
            break

        # Data from PTY → send to Electron
        if master_fd in rlist:
            try:
                data = os.read(master_fd, 65536)
                if data:
                    send_msg({'type': 'data', 'data': base64.b64encode(data).decode()})
                else:
                    # EOF — shell exited
                    break
            except OSError as e:
                import errno
                if e.errno == errno.EIO:
                    # EIO is normal when child resets the PTY — not fatal
                    # Check if main shell is still alive
                    try:
                        os.kill(pid, 0)
                        continue
                    except OSError:
                        break
                else:
                    break

        # Data from Electron → send to PTY
        if sys.stdin.fileno() in rlist:
            try:
                raw = os.read(sys.stdin.fileno(), 65536).decode('utf-8', errors='replace')
                input_buffer += raw
                lines = input_buffer.split('\n')
                input_buffer = lines.pop()
                for line in lines:
                    if not line.strip():
                        continue
                    try:
                        msg = json.loads(line)
                        if msg['type'] == 'input':
                            data = base64.b64decode(msg['data'])
                            os.write(master_fd, data)
                        elif msg['type'] == 'resize':
                            winsize = struct.pack('HHHH', msg['rows'], msg['cols'], 0, 0)
                            fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                            os.kill(pid, signal.SIGWINCH)
                        elif msg['type'] == 'kill':
                            os.kill(pid, signal.SIGTERM)
                    except (json.JSONDecodeError, KeyError):
                        pass
            except OSError:
                break

except KeyboardInterrupt:
    pass
finally:
    try:
        os.kill(pid, signal.SIGTERM)
    except:
        pass
    os.close(master_fd)
