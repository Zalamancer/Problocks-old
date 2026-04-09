/**
 * Prefab system types for serializing and instantiating entity hierarchies.
 */

export interface PrefabComponentData {
  type: string;
  properties: Record<string, any>;
}

export interface PrefabEntityData {
  name: string;
  components: PrefabComponentData[];
  children?: PrefabEntityData[];
}

export interface PrefabDefinition {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  rootEntity: PrefabEntityData;
  parameters?: PrefabParameter[];
  thumbnail?: string;
  createdAt: number;
  version: number;
}

export interface PrefabParameter {
  name: string;
  path: string;
  type: 'number' | 'string' | 'boolean' | 'color' | 'vec2' | 'vec3';
  defaultValue: any;
  min?: number;
  max?: number;
  step?: number;
}

export interface PrefabInstance {
  prefabId: string;
  entityId: string;
  overrides: Record<string, any>;
}
