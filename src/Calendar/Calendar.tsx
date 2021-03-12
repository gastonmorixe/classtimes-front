import React from "react"
import styled, { createGlobalStyle } from "styled-components"
import dayjs, { Dayjs } from "dayjs"
import localeData from "dayjs/plugin/localeData"
import duration from "dayjs/plugin/duration"
import localizedFormat from "dayjs/plugin/localizedFormat"
import weekday from "dayjs/plugin/weekday"
import timezone from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"
import { useQuery, gql } from "@apollo/client"
import IntervalTree from "interval-tree-type"
import {
  RRule
  // RRuleSet,
  // rrulestr
} from "rrule"

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
  startAtHour?: number
  title?: React.ReactNode
  eventTreeCallback: (range: [Dayjs, Dayjs]) => TEventTree
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
  const { eventTreeCallback, title, startAtHour } = props
  const [timezone, setTimezone] = React.useState(() => dayjs.tz.guess())
  const { now } = generateNow()
  const [selectedDate, setSelectedDate] = React.useState(now)
  const { weekDays } = React.useMemo(() => {
    const result = generateWeekdays(selectedDate)
    console.log("generating weekDays", { result })
    return result
  }, [selectedDate])

  const eventTree = React.useMemo(() => {
    return eventTreeCallback([
      weekDays[0].startOf("day"), // if weekdays are ensured to start on the beggining this may be usless extra work.
      weekDays[weekDays.length - 1].endOf("day")
    ])
  }, [weekDays, eventTreeCallback])

  return (
    <CalendarWrapper>
      <GlobalStyles />
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
        {...{
          startAtHour,
          eventTree,
          setSelectedDate,
          selectedDate,
          now,
          weekDays
        }}
      />
    </CalendarWrapper>
  )
}

const valuesEqual = (a: any, b: any) => true

// for(let interval of intervalTree.queryInterval(low, high)){
//   doStuffWith(interval);
// }

// import { RRule, RRuleSet, rrulestr } from 'rrule'

const eventTreeGenerator: TEventGeneratorTyped = (events, recurrenceRange) => {
  const tree = new IntervalTree(valuesEqual)

  if (events) {
    const [startRange, endRange] = recurrenceRange
    const startRangeDate = startRange.toDate()
    const endRangeDate = endRange.toDate()

    for (const event of events) {
      const start = dayjs(event.startDateUtc)
      const end = start.add(event.durationHours, "hours")
      tree.insert(start, end, event)

      if (recurrenceRange && event.rrule) {
        // const rule = RRule.fromString(event.rrule)
        // "DTSTART:20181101T190000;\n"
        // @see {link https://github.com/jakubroztocil/rrule}
        const rule = RRule.fromString(
          // DTSTART:1998-01-18-T23:00:00
          // https://www.kanzaki.com/docs/ical/dateTime.html
          // FORM #2: DATE WITH UTC TIME
          // The date with UTC time, or absolute time, is identified by a LATIN CAPITAL LETTER Z
          // suffix character (US-ASCII decimal 90), the UTC designator,
          // appended to the time value. For example, the following represents
          // January 19, 1998, at 0700 UTC:
          // DTSTART:19980119T070000Z
          // The TZID property parameter MUST NOT be applied to DATE-TIME
          // properties whose time values are specified in UTC.
          // FORM #3: DATE WITH LOCAL TIME AND TIME ZONE REFERENCE
          // The date and local time with reference to time zone information
          // is identified by the use the TZID property parameter to reference
          // the appropriate time zone definition. TZID is discussed in detail
          // in the section on Time Zone. For example, the following represents
          // 2 AM in New York on Janurary 19, 1998:
          // DTSTART;TZID=US-Eastern:19980119T020000
          // Example
          // The following represents July 14, 1997, at 1:30 PM in New
          // York City in each of the three time formats, using the "DTSTART"
          // property.
          //   DTSTART:19970714T133000            ;Local time
          //   DTSTART:19970714T173000Z           ;UTC time
          //   DTSTART;TZID=US-Eastern:19970714T133000    ;Local time and time
          //                      ; zone reference
          // A time value MUST ONLY specify 60 seconds when specifying the
          // periodic "leap second" in the time value. For example:
          //   COMPLETED:19970630T235960Z
          `DTSTART:${start.utc().format("YYYYMMDD[T]HHmmss")}Z\nRRULE:${
            event.rrule
          }`
        )
        // rule.options.dtstart = start.toDate()
        const ruleQuery = rule.between(startRangeDate, endRangeDate, false)

        for (const ruleDate of ruleQuery) {
          if (ruleDate.valueOf() === start.valueOf()) {
            // skip same event
            continue
          }
          // ruleDate.ge
          const clonedEventStart = ruleDate
          const clonedEventEnd = dayjs(ruleDate).add(
            event.durationHours,
            "hours"
          )
          const clonedEvent = Object.create(event, {
            _startDateUtc: { value: clonedEventStart },
            startDateUtc: {
              // toUTCString toISOString toString
              value: clonedEventStart.toISOString()
            },
            _endDateUtc: { value: clonedEventEnd },
            endDateUtc: {
              // toUTCString toISOString toString
              value: clonedEventEnd.toISOString()
            }
          })
          console.log("clonedEvent", {
            ruleDate,
            clonedEvent
            // sd: clonedEvent.startDateUtc
          })
          // clonedEvent.endDateUtc = clonedEvent.startDateUtc.add(
          //   clonedEvent.durationHours,
          //   "hours"
          // )
          tree.insert(
            clonedEvent._startDateUtc,
            clonedEvent._endDateUtc,
            clonedEvent
          )
          // clonedEvent.startDateUtc = clonedEvent.startDateUtc
          // clonedEvent.endDateUtc = clonedEvent.endDateUtc.format()
        }

        console.log({ rule, ruleQuery })

        //  .fromString(
        //   "DTSTART;TZID=America/Denver:20181101T190000;\n"
        //   + "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,TH;INTERVAL=1;COUNT=3"
        // )
        // const rule = RRule.fromString(
        //   "DTSTART;TZID=America/Denver:20181101T190000;\n"
        //   + "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,TH;INTERVAL=1;COUNT=3"
        // )
        // // Create a rule:
        // const rule = new RRule({
        //   freq: RRule.WEEKLY,
        //   interval: 5,
        //   byweekday: [RRule.MO, RRule.FR],
        //   dtstart: new Date(Date.UTC(2012, 1, 1, 10, 30)),
        //   until: new Date(Date.UTC(2012, 12, 31))
        // })
      }
      // start.valueOf()
      // console.log("Adding event to tree", {
      //   start,
      //   end,
      //   startValueOf: start.valueOf(),
      //   endValueOf: end.valueOf()
      // })
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

  const eventTreeCallback = React.useCallback(
    (range: [Dayjs, Dayjs]) => {
      const result = eventTreeGenerator(events, range)
      console.log("save eventTree", result)
      return result
    },
    [data, events]
  )

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
      <Calendar
        startAtHour={5.8}
        showHoursCount={10}
        {...{ title, eventTreeCallback }}
      />
      {/* <Pre>
        loading: {loading ? "loading..." : "loaded"} <br />
        error: {JSON.stringify(error)} <br />
        data: {JSON.stringify(data, null, 2)}
      </Pre> */}
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

const GlobalStyles = createGlobalStyle`
  :root{
    --event-right-margin: 0.2rem;
    
    /** 
      * Week View Body 
     **/
    --week-view-body-bg: rgba(0,0,0,.2);
    --week-view-times-bg: white;
  }
`
