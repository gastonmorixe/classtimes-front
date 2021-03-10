import * as React from "react"
import styled from "styled-components"
import dayjs, { Dayjs } from "dayjs"
import Graph from "graphology"
import { connectedComponents } from "graphology-components"

import { TEventTree } from "../types"
import { GetAllEvents_events } from "../types/GetAllEvents"

const generateTimes = (selectedDate: Dayjs) => {
  const times = Array(24)
    .fill(0)
    .map((a, i) =>
      selectedDate.hour(i).minute(0).second(0).millisecond(0).format("LT")
    )
  return { times }
}

interface IEvent {
  startDate: Dayjs
  endDate: Dayjs
  data: GetAllEvents_events
}

// BODY
interface IWeekViewBody {
  now: Dayjs
  selectedDate: Dayjs
  weekDays: Dayjs[]
  eventTree: TEventTree
}

type TGroupEvent = Array<Set<IEvent>> // column[Set<IEvent>]
type TGroups = Map<number /* dayofWeeek */, Set<TGroupEvent> /* eventsByDay */>

const eventDataToEvent = (eventData: GetAllEvents_events): IEvent => {
  // const eventData = eventData queryResult.value
  const eventStartDate = dayjs(eventData.startDateUtc)
  const eventEndDate = eventStartDate.add(eventData.durationHours, "hours")
  const event: IEvent = {
    startDate: eventStartDate,
    endDate: eventEndDate,
    data: eventData
  }
  return event
}

function overlaps(a1: number, a2: number, b1: number, b2: number) {
  return a2 >= b1 && b2 >= a1
}

function fit(graph: Graph, group: string[]) {
  const cols: Set<IEvent>[] = []

  // Add a first default column for each group
  const firstCol = new Set<IEvent>()
  cols.push(firstCol)

  let nodeInGroup: IEvent | undefined = undefined
  for (const nodeInGroupKey of group) {
    nodeInGroup = graph.getNodeAttributes(nodeInGroupKey) as IEvent

    for (const [colIndex, col] of cols.entries()) {
      const isLastCol = colIndex === cols.length - 1
      let overlapsAny

      for (const nodeInCol of col) {
        if (nodeInGroupKey === nodeInCol.data._id) continue
        if (
          overlaps(
            nodeInGroup.startDate.valueOf(),
            nodeInGroup.endDate.valueOf(),
            nodeInCol.startDate.valueOf(),
            nodeInCol.endDate.valueOf()
          )
        ) {
          overlapsAny = true
          break
        } // else keep looking for overlaps
      }

      if (!overlapsAny) {
        // col.add(nodeInGroupKey)
        col.add(nodeInGroup)
        break
      } else if (isLastCol) {
        const newCol = new Set<IEvent>()
        cols.push(newCol)
        newCol.add(nodeInGroup)
        // newCol.add(nodeInGroupKey)
        // console.log(['will add col for node ', nodeInGroupKey, colIndex, newCol])
      } // else keep trying in next col
    }
  }

  return cols
}

const WeekViewBody: React.FC<IWeekViewBody> = (props) => {
  const { weekDays, selectedDate, eventTree } = props
  const { times } = generateTimes(selectedDate) // todo memoize

  const groupsByWeekDay = React.useMemo(() => {
    let groups: TGroups | undefined

    if (eventTree) {
      groups = new Map()

      for (const dayOfWeek of weekDays) {
        const dayInWeekIndex = dayOfWeek.day()
        const dayStart = dayOfWeek.startOf("day")
        const dayEnd = dayStart.endOf("day")

        // console.log("[dayOfWeek]", {
        //   dayInWeekIndex,
        //   dayStart,
        //   dayStartValue: dayStart.valueOf(),
        //   dayEnd,
        //   dayEndValue: dayEnd.valueOf()
        // })

        const graph = new Graph({
          type: "undirected"
        })

        for (const queryResultA of eventTree.queryInterval(dayStart, dayEnd)) {
          // console.log("queryResult", { queryResultA })

          const eventA = eventDataToEvent(queryResultA.value)

          let nodeA: ReturnType<typeof graph.addNode> | undefined = undefined
          if (!graph.hasNode(eventA.data._id)) {
            nodeA = graph.addNode(eventA.data._id, eventA)
          }

          for (const queryResultB of eventTree.queryInterval(
            eventA.startDate,
            eventA.endDate
          )) {
            const eventBID = queryResultB.value._id
            if (eventBID === eventA.data._id) {
              continue
            }

            let nodeB: ReturnType<typeof graph.addNode> | undefined = undefined
            let eventB: IEvent
            if (!graph.hasNode(eventBID)) {
              eventB = eventDataToEvent(queryResultB.value)
              nodeB = graph.addNode(eventB.data._id, eventB)
            } else {
              eventB = graph.getNodeAttributes(eventBID) as IEvent
            }

            if (nodeA && nodeB && !graph.hasEdge(nodeA, nodeB)) {
              graph.addEdge(nodeA, nodeB)
            }
          }
        }

        const groupsInGraph = connectedComponents(graph)
        const groupsWithColumns = new Set<Set<IEvent>[]>()
        for (const group of groupsInGraph) {
          const groupWithColumn = fit(graph, group)
          groupsWithColumns.add(groupWithColumn)
        }

        groups.set(dayInWeekIndex, groupsWithColumns)
        // console.log("graph " + dayInWeekIndex, {
        //   graph,
        //   groupsInGraph,
        //   groupsWithColumns
        // })
      }
    }

    // console.log("groups", { groups })

    return groups

    // return events?.reduce?.((acc, ev) => {
    //   const startDate = dayjs(ev.startDateUtc)
    //   const weekday = startDate.weekday()
    //   const newEv = [ev, startDate]
    //   const val = acc[weekday] ? [...acc[weekday], newEv] : [newEv]
    //   return { ...acc, [weekday]: val }
    // }, {})
  }, [eventTree, weekDays]) // TODO ??? selectedDate

  // console.log({ groupsByWeekDay, eventTree })

  // TODO Rendering Overlaping Events
  // google "calendar layout overlapping events"
  // @see {@link https://share.clickup.com/t/h/hpxh7u/WQO1OW4DQN0SIZD}
  // @see {@link https://stackoverflow.com/a/11323909/10023158}
  // @see {@link https://jsbin.com/detefuveta/edit}
  // https://github.com/tutorbookapp/tutorbook/blob/d227c5db22c9554d91197bc24d77758ae705c20b/components/calendar/index.tsx#L219
  // https://en.wikipedia.org/wiki/Bin_packing_problem
  // https://stackoverflow.com/questions/11311410/visualization-of-calendar-events-algorithm-to-layout-events-with-maximum-width
  // https://www.google.com/search?q=calendar+overlap+algorithm&tbm=isch&ved=2ahUKEwiv6-O-56HvAhUaNrkGHWzDDMEQ2-cCegQIABAA&oq=calendar+overlap+algorithm&gs_lcp=CgNpbWcQAzoICAAQCBAHEB46AggAOgYIABAIEB46BAgAEBhQ2z9YwUhggkloAHAAeACAAVWIAdkEkgEBOJgBAKABAaoBC2d3cy13aXotaW1nwAEB&sclient=img&ei=sa1GYO_OG5rs5OUP7IaziAw&bih=781&biw=1425&rlz=1C5CHFA_enUY926UY926#imgrc=hOdF30z3tZI5XM
  // https://stackoverflow.com/questions/24136119/most-efficient-reservation-overlap-detection-in-javascript
  // https://stackoverflow.com/questions/10562711/custom-calendar-with-event-divs
  // https://github.com/vlio20/one-day
  // https://stackoverflow.com/questions/32074899/layout-manger-for-swing-jcomponents-representing-calendar-events
  // https://jsbin.com/detefuveta/edit?html,js,output
  // https://github.com/jquense/react-big-calendar/issues/1397
  // https://github.com/jquense/react-big-calendar/pull/1473
  // https://fullcalendar.io/docs/slotEventOverlap

  return (
    <WeekViewBodyWrapper>
      <WeekViewBodyTimesColumnWrapper>
        {times.map((time) => {
          return (
            <WeekViewBodyTimeWrapper key={time}>{time}</WeekViewBodyTimeWrapper>
          )
        })}
      </WeekViewBodyTimesColumnWrapper>

      <WeekViewBodyDayColumnsWrapper>
        {weekDays.map((weekDay, weekDayIndex) => {
          // TODO weekDay indeox to weekDay dayjs obj
          const groups = groupsByWeekDay?.get(weekDayIndex)
          const groupsArray = groups ? Array.from(groups) : undefined

          return (
            <WeekViewBodyDayColumnWrapper key={weekDayIndex}>
              <WeekViewBodyDayEventsColumnWrapper>
                {groupsArray?.map((group, groupIndex) => {
                  // console.log(
                  //   "[WeekViewBodyDay] rendering day: " +
                  //     weekDayIndex +
                  //     " | group: " +
                  //     (groupIndex + 1) +
                  //     "/" +
                  //     groupsArray.length,
                  //   { group, weekDayIndex, groupIndex }
                  // )

                  // <WeekViewEventGroupWrapper>
                  return group.map((col, colIndex) => {
                    const colCount = group.length
                    return Array.from(col).map((ev, eventIndex) => {
                      const { data: event, startDate } = ev

                      let topPosition =
                        startDate.hour() + startDate.minute() / 60
                      topPosition *= 100
                      topPosition /= 24
                      // topPosition = Math.floor(topPosition)

                      const duration = (event.durationHours * 100) / 24

                      // console.log("[WeekViewEventItem]", {
                      //   event,
                      //   startDate,
                      //   colIndex,
                      //   colCount,
                      //   topPosition
                      // })

                      return (
                        <WeekViewEventWrapper
                          {...{ colIndex, colCount, topPosition, duration }}
                          key={event._id}
                        >
                          <div className="content">{event.title}</div>
                        </WeekViewEventWrapper>
                      )
                    })
                  })
                })}
              </WeekViewBodyDayEventsColumnWrapper>
              {times.map((time, i) => (
                <WeekViewBodyDayTimeSlotWrapper key={i}>
                  <span>{time}</span>
                </WeekViewBodyDayTimeSlotWrapper>
              ))}
            </WeekViewBodyDayColumnWrapper>
          )
        })}
      </WeekViewBodyDayColumnsWrapper>
    </WeekViewBodyWrapper>
  )
}

// HEADER

interface IWeekViewHeader {
  // now: Dayjs
  weekDays: Dayjs[]
  selectedDate: Dayjs
}

const WeekViewHeader: React.FC<IWeekViewHeader> = (props) => {
  const { weekDays, selectedDate } = props

  return (
    <WeekViewHeaderWrapper>
      <WeekViewHeaderDayWrapper times />
      {weekDays.map((day, i) => (
        <WeekViewHeaderDayWrapper
          key={i}
          isToday={dayjs().isSame(day, "day")}
          isSelectedDay={selectedDate.isSame(day, "day")}
        >
          <div className="title">{day.format("dddd")}</div>
          <div className="sub-title">{day.format("D")}</div>
        </WeekViewHeaderDayWrapper>
      ))}
    </WeekViewHeaderWrapper>
  )
}

// CONTROLS

interface IWeekViewControls {
  setSelectedDate: (selectedDate: Dayjs) => void
  // selectedDate: Dayjs
}

const WeekViewControls: React.FC<IWeekViewControls> = (props) => {
  const { setSelectedDate } = props

  const onTodayClickHandler = React.useCallback(
    (ev) => {
      setSelectedDate(dayjs())
    },
    [setSelectedDate]
  )

  const onPrevClickHandler = React.useCallback(
    (ev) => {
      setSelectedDate((date: Dayjs) => {
        return date.subtract(1, "week")
      })
    },
    [setSelectedDate]
  )

  const onNextClickHandler = React.useCallback(
    (ev) => {
      setSelectedDate((date: Dayjs) => {
        return date.add(1, "week")
      })
    },
    [setSelectedDate]
  )

  return (
    <WeekViewControlsWrapper>
      <button type="button" onClick={onTodayClickHandler}>
        Today
      </button>
      <button type="button" onClick={onPrevClickHandler}>
        Prev Week
      </button>
      <button type="button" onClick={onNextClickHandler}>
        Next Week
      </button>
    </WeekViewControlsWrapper>
  )
}

interface IWeekView {
  eventTree: TEventTree
  now: Dayjs
  weekDays: Dayjs[]
  setSelectedDate: (selectedDate: Dayjs) => void
  selectedDate: Dayjs
}

export const WeekView: React.FC<IWeekView> = (props) => {
  const { now, weekDays, eventTree, selectedDate, setSelectedDate } = props
  // console.log({ props })
  return (
    <WeekViewWrapper>
      <WeekViewControls {...{ now, setSelectedDate }} />
      <WeekViewHeader {...{ weekDays, now, selectedDate }} />
      <WeekViewBody {...{ eventTree, weekDays, now, selectedDate }} />
    </WeekViewWrapper>
  )
}

const CellBase = styled.div`
  padding: 1rem 0.3rem;
`

// WeekView
const WeekViewWrapper = styled.div`
  /* grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)); */
  /* display: grid;
  grid-template-columns: repeat(7, 1fr); */
  display: flex;
  flex-direction: column;
`

// WeekViewControls
const WeekViewControlsWrapper = styled.div``

// Header
const WeekViewHeaderWrapper = styled.div`
  /* display: grid; */
  /* grid-template-columns: repeat(7, 1fr); */
  display: flex;
  flex-direction: row;
`

interface IWeekViewHeaderDayWrapper {
  isToday?: boolean
  isSelectedDay?: boolean
  times?: boolean
}

const WeekViewHeaderDayWrapper = styled(CellBase)<IWeekViewHeaderDayWrapper>`
  display: flex;
  flex-direction: column;
  flex: ${(p) => (p.times ? undefined : 1)};
  justify-content: center;
  align-items: center;
  /* word-wrap: break-word; */
  /* overflow:hidden; */
  line-height: 1;

  /* background: ${(p) => (p.times ? "red" : undefined)}; */
  width: ${(p) => (p.times ? "4rem" : undefined)};
  flex-shrink: ${(p) => (p.times ? 0 : undefined)};
  /* font-size: ${(p) => (p.times ? "0.75rem" : undefined)}; */

  background-color: ${(p) => (p.isToday ? "skyblue" : undefined)};
  .sub-title {
    font-size: 0.75em;
  }
`

// Body
const WeekViewBodyWrapper = styled.div`
  /* display: grid;
  grid-template-columns: repeat(7, 1fr); */
  position: relative;
  display: flex;
  flex-direction: row;
  flex: 1;
  background: pink;
  /* justify-content: space-between; */
  /* justify-content: space-around; */
  font-size: 0.75rem;
  line-height: 0;
`

const WeekViewBodyTimesColumnWrapper = styled.div`
  display: flex;
  flex-direction: column;

  /* max-width: 10ch; */
  /* width: 10ch; */
  width: 4rem;
  /* background: green; */
  overflow: hidden;
  /* position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column; */
`

const WeekViewBodyTimeWrapper = styled(CellBase)`
  flex: 1;
`

const WeekViewBodyDayColumnsWrapper = styled.div`
  display: flex;
  flex-direction: row;
  flex: 1;

  & > *:nth-child(odd) {
    background: rgba(255, 255, 255, 0.25);
  }
`
const WeekViewBodyDayColumnWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;

  & > *:nth-child(odd) {
    background: rgba(255, 255, 255, 0.5);
  }
`

const WeekViewBodyDayTimeSlotWrapper = styled(CellBase)`
  pointer-events: none; /* TODO Click trap */
  display: flex;
  flex: 1;

  span {
    display: none;
  }
`

// Events
const WeekViewBodyDayEventsColumnWrapper = styled.div`
  position: absolute;
  border: 1px solid red;
  height: 100%;
  width: 100%;
  /* display: none; */
`

interface IWeekViewEventWrapper {
  duration: number
  topPosition: number
  colIndex: number
  colCount: number
}
const WeekViewEventWrapper = styled.div<IWeekViewEventWrapper>`
  line-height: 1;
  position: absolute;
  top: ${(p) => (p.topPosition ? `${p.topPosition}%` : 0)};
  background: white;
  box-shadow: inset 0 0 0 2px black;
  padding: 0.25rem;
  width: ${(p) => Math.floor((1 / p.colCount) * 100)}%;
  left: ${(p) => Math.floor((p.colIndex / p.colCount) * 100)}%;
  height: ${(p) => (p.duration ? `${p.duration}%` : undefined)};
  /* padding: 0.5rem; */
  text-align: left;
  overflow: hidden;

  .content {
    position: absolute;
    /* left: 0;
    top: 0; */
  }
`

// Group
const WeekViewEventGroupWrapper = styled.div``
