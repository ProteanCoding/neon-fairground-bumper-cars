import { ColliderLayer, Entity, GltfContainer, InputAction, Material, MeshCollider, MeshRenderer, Name, PointerEventType, PointerEventsResult, PointerLock, Transform, TransformType, VisibilityComponent, engine } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { syncEntity } from '@dcl/sdk/network'
import { getPlayer, onLeaveScene } from '@dcl/sdk/src/players'
import { HideUI, SimplePopup } from './UI'
import { C4, CreateFrom, NewEntity, PlaceGltf, QEuler, V3 } from './utils'

const sceneWidth = 64, padding = 2, taxiSpawnPosition = V3(10, 0, 10)
var { myUserId, carSpawned, buttonIsPressed, myTaxi, ignition, inertia, rotateRight, rotateLeft, myPreviousPosition, taxiPositions, eiffelTower, bumps1, bumps2, victory } = {
  myUserId: '',
  carSpawned: false,
  buttonIsPressed: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
  myTaxi: engine.RootEntity,
  ignition: false,
  inertia: V3(0, 0, 0),
  rotateRight: QEuler(0, 5, 0),
  rotateLeft: QEuler(0, -5, 0),
  myPreviousPosition: taxiSpawnPosition,
  taxiPositions: new Map<Entity, Vector3>(),
  eiffelTower: engine.RootEntity,
  bumps1: 0,
  bumps2: '',
  victory: false,
}

export function main() {
  myUserId = getPlayer()!.userId

  CreateFrom(
    NewEntity(V3(sceneWidth / 2, 0, sceneWidth / 2), undefined, V3(sceneWidth / 2 - padding, 1, sceneWidth / 2 - padding)),
    GltfContainer, { src: 'models/skate_ice.glb', visibleMeshesCollisionMask: ColliderLayer.CL_NONE }
  )

  placeWalls()

  onLeaveScene(leaveScene)

  ShowInstructions()

  engine.addSystem(dt => {
    try {
      go(dt)

    } catch (e) {
      console.error(String(e))
    }
  })

  eiffelTower = NewEntity(V3(sceneWidth / 2, 3, sceneWidth / 2), undefined, V3(sceneWidth * 0.75, sceneWidth * 0.85, sceneWidth * 0.75))
  PlaceGltf('EiffelTower.glb', eiffelTower, false)
  VisibilityComponent.create(eiffelTower)
}

function ShowInstructions() {
  SimplePopup(''
    + 'Welcome to Bumper-Cars !' + '\n'
    + 'Step in the car which spawned for you' + '\n'
    + '(you may need to run off-parcel and back).' + '\n'
    + 'Use SHIFT to walk into the car seat (instead of running).' + '\n'
    + 'Lock the mouse pointer' + '\n'
    + '(LEFT CLICK, or hold RIGHT CLICK depending on your settings).' + '\n'
    + '"E" to start the engine.' + '\n'
    + '"F" to stop the engine.' + '\n'
    + '"1" to show the instructions.' + '\n'
    + '"2" to hide the instructions.' + '\n'
    + '"3" to show the Eiffel Tower (original source: Google Earth).' + '\n'
    + '"4" to hide the Eiffel Tower (if there are performance issues).' + '\n'
    + '\n'
    + 'While the Game Jam is in progress, you can win a reward !' + '\n'
    + 'Bump against at least two other player cars, for a total of 20 times.'
  )
}

function placeWalls() {
  placePlane(padding, sceneWidth / 2, 90)
  placePlane(sceneWidth / 2, padding, 0)
  placePlane(sceneWidth - padding, sceneWidth / 2, 90)
  placePlane(sceneWidth / 2, sceneWidth - padding, 0)

  function placePlane(x: number, y: number, r: number) {
    let wall = engine.addEntity()

    MeshRenderer.setPlane(wall)
    MeshCollider.setPlane(wall)

    Transform.create(wall, {
      scale: V3(sceneWidth, 3.34, 1),
      position: V3(x, 0.07 - 0.085, y),
      rotation: QEuler(0, r, 0),
    })

    Material.setBasicMaterial(wall, {
      diffuseColor: C4(100, 70, 0, 255)
    })
  }
}

function createTaxi() {
  myTaxi = engine.addEntity()
  Name.create(myTaxi, { value: myUserId })
  Transform.create(myTaxi, { position: taxiSpawnPosition, scale: V3(0.7, 0.7, 0.7) })
  GltfContainer.create(myTaxi, { src: 'models/Topless_taxi.glb' })
  syncEntity(myTaxi, [Transform.componentId])
}

function leaveScene(userId: string) {
  [...engine.getEntitiesWith(Name)].forEach(([entity, { value }]) => {
    if (value === userId) {
      engine.removeEntity(entity)
    }
  })
}

let dtAverage = Number.MAX_SAFE_INTEGER
const dtThreshold = 0.12
function go(dt: number) {
  let playerPos = Transform.get(engine.PlayerEntity).position
  if ((playerPos.x <= 0) || (playerPos.z <= 0) || (playerPos.x >= sceneWidth) || (playerPos.z >= sceneWidth)) {
    return
  }

  let myTaxiTransform = Transform.getMutableOrNull(myTaxi)

  processKeypresses(myTaxiTransform, dt)

  if (!carSpawned) {
    dtAverage = dtAverage / 1.5 + dt
    if (dtAverage > dtThreshold) {
      return
    }

    carSpawned = true
    createTaxi()
  }

  if (!myTaxiTransform) {
    return
  }

  rescaleInertia()

  moveTaxi(myTaxiTransform, dt)

  bounceTaxis(myTaxiTransform)
}

function processKeypresses(taxiTransform: TransformType | null, dt: number) {
  for (let cmd of [...[...engine.getEntitiesWith(PointerEventsResult)][0]?.[1] || []]) {
    buttonIsPressed[cmd.button] = (cmd.state === PointerEventType.PET_DOWN)
  }

  if (buttonIsPressed[InputAction.IA_ACTION_3]) {
    ShowInstructions()
  }

  if (buttonIsPressed[InputAction.IA_ACTION_4]) {
    HideUI()
  }

  if (buttonIsPressed[InputAction.IA_ACTION_5]) {
    VisibilityComponent.getMutable(eiffelTower).visible = true
  }

  if (buttonIsPressed[InputAction.IA_ACTION_6]) {
    VisibilityComponent.getMutable(eiffelTower).visible = false
  }

  if (buttonIsPressed[InputAction.IA_PRIMARY]) {
    ignition = true
  }

  if (buttonIsPressed[InputAction.IA_SECONDARY]) {
    ignition = false
  }

  if (!taxiTransform) {
    return
  }

  if (ignition && PointerLock.get(engine.CameraEntity).isPointerLocked) {
    if (buttonIsPressed[InputAction.IA_RIGHT]) {
      taxiTransform.rotation = Quaternion.multiply(taxiTransform.rotation, rotateRight)
    }

    if (buttonIsPressed[InputAction.IA_LEFT]) {
      taxiTransform.rotation = Quaternion.multiply(taxiTransform.rotation, rotateLeft)
    }

    if (buttonIsPressed[InputAction.IA_FORWARD]) {
      inertia = Vector3.lerp(inertia, Vector3.rotate(V3(0, 0, 15), taxiTransform.rotation), dt / 20)
    }

    if (buttonIsPressed[InputAction.IA_BACKWARD]) {
      inertia = Vector3.add(inertia, Vector3.rotate(V3(0, 0, -0.007), taxiTransform.rotation))
    }
  }
}

function rescaleInertia() {
  let inertiaMagnitude = Vector3.lengthSquared(inertia)
  let rescaleValue = ignition ? 0.975 : 0.75

  const maxSpeed = 100000000
  if (inertiaMagnitude > maxSpeed) {
    rescaleValue = Math.sqrt(maxSpeed / inertiaMagnitude)
  }

  inertia = Vector3.scale(inertia, rescaleValue)
}

function moveTaxi(taxiTransform: TransformType, dt: number) {
  myPreviousPosition = taxiTransform.position
  taxiTransform.position = Vector3.add(taxiTransform.position, Vector3.scale(inertia, dt * 12))

  for (let hadBounce = true; hadBounce;) {
    hadBounce = false

    const lBound = padding * 2
    const rBound = sceneWidth - lBound

    if (taxiTransform.position.x > rBound) {
      taxiTransform.position.x = rBound - (taxiTransform.position.x - rBound)
      inertia.x = -inertia.x
      hadBounce = true
    }
    if (taxiTransform.position.z > rBound) {
      taxiTransform.position.z = rBound - (taxiTransform.position.z - rBound)
      inertia.z = -inertia.z
      hadBounce = true
    }
    if (taxiTransform.position.x < lBound) {
      taxiTransform.position.x = lBound + (lBound - taxiTransform.position.x)
      inertia.x = -inertia.x
      hadBounce = true
    }
    if (taxiTransform.position.z < lBound) {
      taxiTransform.position.z = lBound + (lBound - taxiTransform.position.z)
      inertia.z = -inertia.z
      hadBounce = true
    }
  }
}

function bounceTaxis(myTaxiTransform: TransformType) {
  const bounceDistance = 16

  for (let [taxi, { value: userId }] of [...engine.getEntitiesWith(Name)]) {
    if (userId === myUserId) {
      continue
    }

    let currentPosition = Transform.get(taxi).position
    let currentDistance = Vector3.distanceSquared(myTaxiTransform.position, currentPosition)
    let previousPosition = taxiPositions.get(taxi)

    if (previousPosition) {
      let previousDistance = Vector3.distanceSquared(myPreviousPosition, previousPosition)

      if ((currentDistance < bounceDistance) && (previousDistance > currentDistance)) {
        inertia = Vector3.subtract(currentPosition, previousPosition)

        if (!victory) {
          ++bumps1

          if (bumps2 === '') {
            bumps2 = userId

          } else if (bumps2 != userId) {
            bumps2 = 'score'
          }

          if ((bumps1 >= 20) && (bumps2 === 'score')) {
            victory = true
            SimplePopup('You won for the Game Jam !\n("2" Close)')
          }
        }
      }
    }

    taxiPositions.set(taxi, currentPosition)
  }
}
