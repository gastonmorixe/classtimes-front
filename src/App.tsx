import { ApolloClient, InMemoryCache } from "@apollo/client"
import { ApolloProvider } from "@apollo/client"

import { CalendarWithData } from "./Calendar"

import "./styles.css"

const client = new ApolloClient({
  uri: "https://classtimes.herokuapp.com/graphql",
  cache: new InMemoryCache()
})

export default function App() {
  return (
    <ApolloProvider {...{ client }}>
      <div className="App">
        <CalendarWithData />
      </div>
    </ApolloProvider>
  )
}
