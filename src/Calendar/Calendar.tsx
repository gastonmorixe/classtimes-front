import React from "react"
import styled from "styled-components"
import dayjs, { Dayjs } from "dayjs"
import localeData from "dayjs/plugin/localeData"
import duration from "dayjs/plugin/duration"
import localizedFormat from "dayjs/plugin/localizedFormat"
import weekday from "dayjs/plugin/weekday"
import timezone from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"
import { useQuery, gql } from "@apollo/client"
import IntervalTree from "interval-tree-type"

import { GetAllEvents } from "../types/GetAllEvents"
import {
  TEventTree,
  // IEventTreeQueryInterval,
  // IEventTreeGeneratorReturn,
  // TEventGenerator,
  TEventGeneratorTyped
} from "../types"
import { WeekView } from "./WeekView"

dayjs.extend(duration)
dayjs.extend(localeData)
dayjs.extend(localizedFormat)
dayjs.extend(weekday)
dayjs.extend(utc)
dayjs.extend(timezone)

//dayjs.locale('en')

const ALL_EVENTS = gql`
  query GetAllEvents {
    events(filters: null) {
      _id
      title
      isAllDay
      durationHours
      startDateUtc
      endDateUtc
      rrule
      exceptionsDatesUtc
      calendar(populate: true) {
        _id
        name
      }
    }
  }
`

interface ICalendar {
  title?: React.ReactNode
  eventTree: TEventTree
}

const generateWeekdays = (selectedDate: Dayjs) => {
  // const weekDays = dayjs.weekdays()
  const weekDays = Array(7)
    .fill(null)
    .map((a, i) => {
      return selectedDate
        .startOf("week")
        .weekday(i)
        .hour(0)
        .minute(0)
        .millisecond(0)
    })

  // dayjs.localeData/().weekdays()

  // const week = dayjs.duration({ weeks: 1 }).days()
  // const day =
  return { weekDays } //JSON.stringify(week)
}

const generateNow = () => {
  const now = dayjs()
  // dayjs.localeData/().weekdays()

  // const week = dayjs.duration({ weeks: 1 }).days()
  // const day =
  return { now } //JSON.stringify(week)
}

export const Calendar: React.FC<ICalendar> = (props) => {
  const { eventTree, title } = props
  const [timezone, setTimezone] = React.useState(() => dayjs.tz.guess())
  const { now } = generateNow()
  const [selectedDate, setSelectedDate] = React.useState(now)
  const { weekDays } = React.useMemo(() => {
    const result = generateWeekdays(selectedDate)
    console.log("generating weekDays", { result })
    return result
  }, [selectedDate])

  return (
    <CalendarWrapper>
      {title && <CalendarTitle className="title">{title}</CalendarTitle>}
      <CalendarSubtitle className="subtitle">
        {selectedDate.format("MMMM YYYY")}
      </CalendarSubtitle>
      <CalendarTimezone className="time-zone">
        <select defaultValue={timezone}>
          <option value={timezone}>{timezone}</option>
          <option value={timezone} disabled>
            TODO Add Timezones
          </option>
        </select>
      </CalendarTimezone>
      <WeekView
        {...{ eventTree, setSelectedDate, selectedDate, now, weekDays }}
      />
    </CalendarWrapper>
  )
}

const valuesEqual = (a: any, b: any) => true

// for(let interval of intervalTree.queryInterval(low, high)){
//   doStuffWith(interval);
// }

const eventTreeGenerator: TEventGeneratorTyped = (events) => {
  const tree = new IntervalTree(valuesEqual)

  if (events) {
    for (const event of events) {
      const start = dayjs(event.startDateUtc)
      const end = start.add(event.durationHours, "hours")
      // start.valueOf()
      // console.log("Adding event to tree", {
      //   start,
      //   end,
      //   startValueOf: start.valueOf(),
      //   endValueOf: end.valueOf()
      // })
      tree.insert(start, end, event)
    }

    return {
      tree,
      queryInterval: tree.queryInterval.bind(tree)
    }
  }

  return
}

export const CalendarWithData = () => {
  const { loading, error, data } = useQuery<GetAllEvents>(ALL_EVENTS)

  const title = data?.events?.[0]?.calendar?.name
  const events = data?.events

  const eventTree = React.useMemo(() => {
    const result = eventTreeGenerator(events)
    console.log("save eventTree", result)
    return result
  }, [events])

  // if (eventTree) {
  //   console.log("eventTree parsing", { eventTree })
  //   for (const result of eventTree.queryInterval(-Infinity, Infinity)) {
  //     // ev.value.
  //     console.log("result", { result })
  //     // const event = result.value
  //   }
  // }

  return (
    <>
      <Calendar {...{ title, eventTree }} />
      <Pre>
        loading: {loading ? "loading..." : "loaded"} <br />
        error: {JSON.stringify(error)} <br />
        data: {JSON.stringify(data, null, 2)}
      </Pre>
    </>
  )
}

const CalendarWrapper = styled.div`
  border: 1px solid black;
`

const Pre = styled.pre`
  text-align: left;
`

const CalendarTitle = styled.h2``
const CalendarSubtitle = styled.div``
const CalendarTimezone = styled.div``
