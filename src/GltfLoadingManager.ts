import * as ECS from '@dcl/sdk/ecs'
// import { HideUI, SimplePopup } from './UI'

type EntityBuilder = () => ECS.Entity

class LoadingManager {
  add(makeEntity: EntityBuilder, logTag?: string) {
    if (logTag) this.logTag = logTag

    if (this.entityList.size == 0) {
      ECS.engine.addSystem(this.loadingStateManager.bind(this), 10)
    }

    let entity = makeEntity()
    this.entityList.set(entity, makeEntity)
    ++this.maxCount

    if (!LoadingManager.doneOnce) {
      this.displayProgress()
      LoadingManager.doneOnce = true
    }
  }

  entityList = new Map<ECS.Entity, EntityBuilder>()
  maxCount = 0
  doneCount = 0
  retryCount = 0
  logTag?:string
  static doneOnce = false

  private finalize(entity: ECS.Entity) {
    this.entityList.delete(entity)

    ++this.doneCount
    this.displayProgress()

    if (this.entityList.size == 0) {
      console.log('GltfLoadingManager all done ! ' + this.doneCount + ' / ' + this.maxCount)
      // HideUI()
      ECS.engine.removeSystem(this.loadingStateManager.bind(this))
      this.maxCount = this.doneCount = 0
    }
  }

  private displayProgress() {
    return;
    // SimplePopup('Loading Scene Entities\n' + (this.maxCount - this.doneCount) + ' remaining'
    //   + (this.retryCount ? '\n ' + this.retryCount + ' retries' : '')
    // )
  }

  private loadingStateManager() {
    this.entityList.forEach((entityBuilder, entity) => {
      let loadingState = ECS.GltfContainerLoadingState.getOrNull(entity)

      if (!loadingState || (loadingState.currentState == ECS.LoadingState.LOADING)) {
        return
      }

      if (loadingState.currentState == ECS.LoadingState.FINISHED) {
        this.finalize(entity)
        return
      }

      // Problem, we retry
      ECS.engine.removeEntity(entity)
      --this.maxCount
      ++this.retryCount
      console.error((this.logTag ? this.logTag : 'A model') + ' did\'t load ! Retrying')
      this.add(entityBuilder)
    })
  }
}

export const GltfLoadingManager = new LoadingManager()
