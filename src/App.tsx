import type { Component, ParentProps } from 'solid-js'
import { Navigate, Route } from '@solidjs/router'
import { HashRouter, KeepAliveRoute } from '@solidtv/solid/primitives/router'
import Home from './pages/Home'
import Details from './pages/Details'
import ExitDialog from './components/ExitDialog'
import { layout } from './theme'

const Root: Component<ParentProps> = (props) => (
  // No fill: the page background is the body's CSS colour, so the canvas can be see-through where
  // the hero's preview video plays behind it (see index.html and host.ts).
  <view width={layout.width} height={layout.height}>
    {props.children}
    <ExitDialog />
  </view>
)

// Home is kept alive across navigation so the whole focus model and loaded rows survive a trip
// to the details page (back-with-state at zero cost).
const App: Component = () => (
  <HashRouter root={Root}>
    <KeepAliveRoute id="home" path="/" component={Home} />
    <Route path="/details" component={Details} />
    <Route path="/*all" component={() => <Navigate href="/" />} />
  </HashRouter>
)

export default App
