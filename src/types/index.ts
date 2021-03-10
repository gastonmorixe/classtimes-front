import { Dayjs } from "dayjs"
import { GetAllEvents_events } from "./GetAllEvents"

export interface IEventTreeQueryInterval<T extends unknown> {
  high: number
  low: number
  value: T
}

interface TValueOf {
  valueOf(): number
}

export interface IEventTreeGeneratorReturn<K> {
  tree: any
  queryInterval<T>(
    low: number | TValueOf,
    high: number | TValueOf
  ): IterableIterator<IEventTreeQueryInterval<K extends undefined ? T : K>>
}

// function getKeysValues<K extends keyof typeof data>(...keys: Array<K>): Array<typeof data[K]> {
//   return keys.map(k => data[k]);
// }

export type TEventGenerator<T> = {
  <K extends T>(events: K[] | undefined, recurrenceRange: [start: Dayjs, end: Dayjs]): IEventTreeGeneratorReturn<K>
}

export type TEventGeneratorTyped = TEventGenerator<GetAllEvents_events>

export type TEventTree =
  | IEventTreeGeneratorReturn<GetAllEvents_events>
  | undefined
