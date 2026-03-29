import { Gear, GearTrain } from './gear.js';
import { Spring } from './spring.js';
import { Linkage } from './linkage.js';
import { Motor } from './motor.js';

/**
 * A complete mechanical system combining motors, gears, springs, and linkages.
 */
export class MechanicalSystem {
  readonly motors: Map<string, Motor> = new Map();
  readonly gearTrains: Map<string, GearTrain> = new Map();
  readonly springs: Map<string, Spring> = new Map();
  readonly linkages: Map<string, Linkage> = new Map();

  addMotor(motor: Motor): void { this.motors.set(motor.id, motor); }
  addGearTrain(id: string, train: GearTrain): void { this.gearTrains.set(id, train); }
  addSpring(spring: Spring): void { this.springs.set(spring.id, spring); }
  addLinkage(linkage: Linkage): void { this.linkages.set(linkage.id, linkage); }

  /** Connect a motor to a gear train */
  connectMotorToTrain(motorId: string, trainId: string): void {
    const motor = this.motors.get(motorId);
    const train = this.gearTrains.get(trainId);
    if (motor && train) {
      train.drive(motor.running ? motor.rpm : 0);
    }
  }

  /** Step the entire system */
  step(dt: number): void {
    // Update motor-driven gear trains
    for (const [, motor] of this.motors) {
      // Motors are connected to gear trains via connectMotorToTrain
    }

    // Step gear trains
    for (const [, train] of this.gearTrains) {
      train.step(dt);
    }

    // Step springs
    for (const [, spring] of this.springs) {
      spring.step(dt, 1.0); // default mass
    }

    // Step linkages
    for (const [, linkage] of this.linkages) {
      linkage.step(dt);
    }
  }

  /** Get system energy (sum of spring energies) */
  getTotalEnergy(): number {
    let energy = 0;
    for (const [, spring] of this.springs) {
      energy += spring.getPotentialEnergy() + spring.getKineticEnergy(1.0);
    }
    return energy;
  }
}
