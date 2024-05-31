import ReactEcs, { AlignType, JSX, JustifyType, PositionType, ReactEcsRenderer, UiEntity, } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

ReactEcsRenderer.setUiRenderer(() => myRenderer)

export function SetUiRendering(element: ReactEcs.JSX.Element) {
  myRenderer = element
}

export function HideUI() {
  myRenderer = uiNone
}

export function SimplePopup(text: string, vertical: AlignType = 'center', horizontal: JustifyType = 'center') {
  myRenderer = popup(text, vertical, horizontal)
}

const uiNone = (<UiEntity uiTransform={{ display: 'none', width: '100%', height: '100%', alignItems: 'center' }} />)
let myRenderer: ReactEcs.JSX.Element = uiNone

function popup(text: string, vertical: AlignType, horizontal: JustifyType, positionType: PositionType = 'absolute', color: Color4 = Color4.White()): JSX.Element {
  return (
    <UiEntity uiTransform={{
      alignItems: vertical, justifyContent: horizontal, positionType: positionType,
      alignSelf: 'center', minWidth: '100%'
    }}>
      <UiEntity
        uiTransform={{ width: 'auto', height: 'auto', padding: 20 }}
        uiBackground={{ color: color }}
        uiText={{ value: text, fontSize: 14, color: Color4.Black() }}
        onMouseDown={HideUI}
      />
    </UiEntity>
  )
}
