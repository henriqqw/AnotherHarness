import { Service } from '@anotherharness/cordis'

/** Service whose public annotations are intentionally absent. */
export class WritableService extends Service {
  value = 1

  echo(input = 'value') {
    return input
  }
}

declare module '@anotherharness/cordis' {
  interface Context {
    writable: WritableService
  }
}

export default WritableService
