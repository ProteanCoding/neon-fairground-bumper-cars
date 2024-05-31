import * as ECS from '@dcl/sdk/ecs'
import * as TLL from '@dcl-sdk/utils'
import { Color3, Color4, Vector3, Quaternion } from "@dcl/sdk/math"
import { GltfLoadingManager } from "./GltfLoadingManager"

export function JLog(object: any) {
  console.log(JSON.stringify(object))
}

export function LogError(error: unknown) {
  console.error((error as Error)?.stack || String(error) || "UNKNOWN ERROR")
}

export function LogAndRethrow(error: unknown) {
  LogError(error)

  throw error
}

export function SafeTry(runner: Function | FunctionConstructor): ECS.SystemFn {
  return () => {
    try {
      runner()

    } catch (e) {
      console.error(String(e))
    }
  }
}

export function TryCatchAsync(runner: Function | FunctionConstructor) {
  ECS.executeTask(async () => {
    try {
      await runner()

    } catch (e) {
      LogAndRethrow(e)
    }
  })
}

export const C3 = Color3.fromInts
export const C4 = Color4.fromInts
export const V3 = Vector3.create
export const QEuler = Quaternion.fromEulerDegrees
export const QFromEuler = (vector: Vector3) => QEuler(vector.x, vector.y, vector.z)
export const Q0 = Quaternion.Identity()

export function NewEntity(position?: Vector3, rotation?: Quaternion, scale?: Vector3, parent?: ECS.Entity): ECS.Entity {
  let entity = ECS.engine.addEntity()
  let transformWithOptionals: ECS.TransformTypeWithOptionals = {}

  if (position) transformWithOptionals.position = position
  if (rotation) transformWithOptionals.rotation = rotation
  if (scale) transformWithOptionals.scale = scale
  if (parent) transformWithOptionals.parent = parent

  ECS.Transform.create(entity, transformWithOptionals)

  return entity
}

export function CreateFrom<T>(entity: ECS.Entity, pbComponent: ECS.LastWriteWinElementSetComponentDefinition<T>, initialValue?: T): ECS.Entity {
  pbComponent.create(entity, initialValue)
  return entity
}

export function Create<T>(pbComponent: ECS.LastWriteWinElementSetComponentDefinition<T>, initialValue?: T): ECS.Entity {
  return CreateFrom(ECS.engine.addEntity(), pbComponent, initialValue)
}

export function NewBox(entity: ECS.Entity, uvs?: number[]): ECS.Entity {
  ECS.MeshRenderer.setBox(entity, uvs)
  return entity
}

export function PlaceGltf(model: String, base: ECS.Entity, hasCollision = true) {
  GltfLoadingManager.add(() =>
    CreateFrom(base, ECS.GltfContainer, {
      src: 'models/' + model,
      visibleMeshesCollisionMask: hasCollision ? ECS.ColliderLayer.CL_PHYSICS : ECS.ColliderLayer.CL_NONE,
      invisibleMeshesCollisionMask: hasCollision ? ECS.ColliderLayer.CL_PHYSICS : ECS.ColliderLayer.CL_PHYSICS,
    })
  )
}

export function Texture(model: String, filterMode = ECS.TextureFilterMode.TFM_TRILINEAR): ECS.TextureUnion {
  return ECS.Material.Texture.Common({ src: 'models/' + model, filterMode: filterMode })
}

export function NewButton(entity: ECS.Entity, parameters: Partial<ECS.EventSystemOptions>, onPress: ECS.EventSystemCallback, setOnPointerUp = false) {
  if (!ECS.MeshCollider.getOrNull(entity)) {
    ECS.MeshCollider.setBox(entity, ECS.ColliderLayer.CL_POINTER) // TODO: find actual bounding-box instead of just using the default `scale` this way
  }

  if (setOnPointerUp) {
    ECS.pointerEventsSystem.onPointerUp({ entity: entity, opts: parameters }, onPress)

  } else {
    ECS.pointerEventsSystem.onPointerDown({ entity: entity, opts: parameters }, onPress)
  }
}

export function SetupButtonSwitch(button: ECS.Entity, isPlay = true) {
  if (!ECS.MeshCollider.getOrNull(button)) {
    ECS.MeshCollider.setBox(button, ECS.ColliderLayer.CL_POINTER)
  }

  ECS.pointerEventsSystem.onPointerDown(
    {
      entity: button,
      opts: { button: ECS.InputAction.IA_POINTER, hoverText: isPlay ? 'Play' : 'Stop' }
    },
    () => {
      ECS.AudioSource.getMutable(button).playing = isPlay
      isPlay = !isPlay

      let eventInfo = ECS.PointerEvents.getMutable(button)?.pointerEvents?.[0]?.eventInfo
      if (eventInfo) {
        eventInfo.hoverText = isPlay ? 'Play' : 'Stop'
      }
    }
  )
}

export function SetButtonHoverText(button: ECS.Entity, text: string) {
  let eventInfo = ECS.PointerEvents.getMutable(button)?.pointerEvents?.[0]?.eventInfo
  if (eventInfo) {
    eventInfo.hoverText = text
  }
}

export class RotatingFacer {
  entity: ECS.Entity
  position: Vector3
  initialY: number
  currentOrientation = Q0
  triggerDistance = 5
  targetMomentum = QEuler(24, 0, 0)
  facing = 0
  clock = 0

  constructor(entity: ECS.Entity) {
    this.entity = entity
    this.position = TLL.getWorldPosition(entity)
    this.initialY = Quaternion.toEulerAngles(TLL.getWorldRotation(entity)).y
    ECS.engine.addSystem(this.rotate.bind(this), 0)
  }

  flip() {
    this.facing = 180 - this.facing
  }

  rotate(dT: number) {
    this.clock += dT * 25
    let playerPosition = ECS.Transform.get(ECS.engine.PlayerEntity).position
    let mutableTransform = ECS.Transform.getMutable(this.entity)
    let target: Quaternion.MutableQuaternion

    if (Vector3.distanceSquared(playerPosition, this.position) > this.triggerDistance) {
      target = QEuler(this.clock, this.initialY, 0)

    } else {
      target = Quaternion.fromLookAt(this.position, playerPosition)
      let adjustment = Quaternion.toEulerAngles(target)
      adjustment.x = 90 - adjustment.x + this.facing
      adjustment.y = adjustment.y - 90
      target = QFromEuler(adjustment)
    }

    mutableTransform.rotation = Quaternion.slerp(mutableTransform.rotation, target, dT * 4)
  }
}
