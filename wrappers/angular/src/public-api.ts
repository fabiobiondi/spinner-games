// Public entry point for the Angular wrappers (`spinner-games/angular`).
//
// Side-effect import: registers the underlying custom elements
// (`<spinner-pong>`, `<spinner-breakout>`, …) so the directives have real
// elements to attach to. Resolves to the consumer's installed `spinner-games`
// at runtime (declared as a peer dependency).
import 'spinner-games'

export {
  SpinnerPong,
  SpinnerBreakout,
  SpinnerBubbles,
  SpinnerFlappy,
  SpinnerPlinko,
  SPINNER_GAMES_DIRECTIVES,
} from './spinner-games.directives'
