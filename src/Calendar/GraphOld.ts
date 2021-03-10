// class Node<T> {
//   value: T
//   connections: Set<Node<T>>
//   // connections
//   constructor(value: T, children = new Set<Node<T>>()) {
//     this.value = value
//     this.connections = children
//   }
//   addChild(node: Node<T>) {
//     this.connections.add(node)
//     return this
//   }
// }

// class Graph<T> {
//   root: Node<T>
//   adjList: Map<Node<T>, Set<Node<T>>> = new Map()
//   constructor(root: Node<T>) {
//     this.root = root
//   }
//   addValue<T>(value: T) {
//     const node = new Node<T>(value)
//     return node
//   }

//   // add edge
//   connect(nodeA: Node<T>, nodeB: Node<T>) {
//     // vertex w denoting edge between v and w
//     let edge

//     edge = this.adjList.get(nodeA)
//     if (!edge) {
//       this.adjList.set(nodeA, new Set())
//     }
//     this?.adjList?.get(nodeA)?.add(nodeB)

//     edge = this.adjList.get(nodeB)
//     if (!edge) {
//       this.adjList.set(nodeB, new Set())
//     }
//     this?.adjList?.get(nodeB)?.add(nodeA)
//   }
// }
