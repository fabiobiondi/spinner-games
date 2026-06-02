// Ambient declaration for the side-effect import in `public-api.ts`.
//
// The Angular package only needs `import 'spinner-games'` to register the
// custom elements at runtime; it doesn't consume any of the core's types. This
// keeps the directive build decoupled from the core build output, and
// `spinner-games` stays external (a peer dependency) in the published bundle.
declare module 'spinner-games'
