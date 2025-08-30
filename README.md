<!-- ![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png) -->


# <img src="assets/n8n_pink+white_logo.svg" alt="n8n" width="50" /> 🤝 <img src="nodes/MongoDbEx/mongodb.svg" alt="n8n" height="35" /><br/>n8n node MongoDb Ex _(tended)_

`n8n-nodes-mongodb-ex`

An extended [n8n](https://n8n.io/) MongoDB tailor-made for native MongoDB developers. This node goes beyond the built-in MongoDB node by providing authentic MongoDB query syntax, advanced update operators, update pipelines, arrayFilters, bulk operations, type coercion and more.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Features](#features)
- [Operations](#operations)
- [Usage Examples](#usage-examples)
- [Compatibility](#compatibility)
- [License](#license)

## Overview

MongoDB Extended (MongoDbEx) is a drop-in replacement for n8n’s base MongoDB node with a richer, MongoDB-native developer experience:

- Use real MongoDB query syntax and aggregation pipelines
- Leverage advanced update operators and update pipelines
- Target array elements precisely with arrayFilters and positional operators
- Perform single or bulk operations (insertMany/updateMany/bulkWrite)
- Automatic type coercion for ObjectId and ISO dates

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/), then search for and install `n8n-nodes-mongodb-ex`.

Alternatively, install directly:

```bash
npm install n8n-nodes-mongodb-ex
```

For Docker-based deployments, add to your n8n Docker image:

```dockerfile
RUN cd /usr/local/lib/node_modules/n8n && npm install n8n-nodes-mongodb-ex
```

## Features

- MongoDB-native queries and pipelines
- Advanced update operators: `$set`, `$unset`, `$inc`, `$push`, `$pull`, etc.
- [Update pipelines](https://www.mongodb.com/docs/manual/tutorial/update-documents-with-aggregation-pipeline/) supported (array of stages)
- Array element targeting with [arrayFilters](https://www.mongodb.com/docs/manual/reference/operator/update/positional-filtered/)
- Bulk operations: [insertMany](https://www.mongodb.com/docs/manual/reference/method/db.collection.insertMany/#mongodb-method-db.collection.insertMany), [updateMany](https://www.mongodb.com/docs/manual/reference/method/db.collection.updateMany/#mongodb-method-db.collection.updateMany), [bulkWrite](https://www.mongodb.com/docs/manual/reference/method/db.collection.bulkWrite/)
- JSON input for queries, documents, updates
- Automatic type coercion of 24-hex ObjectId strings and ISO date strings
- Upsert support for updates

## Operations

- Aggregate: Run full MongoDB aggregation pipelines
- Find: Query documents using native MongoDB operators
- Insert: Insert one or many documents
- Update: Update one or many documents with operators or update pipelines
- FindOneAndUpdate: Atomic find-and-update with full MongoDB update support
- FindOneAndReplace: Atomic find-and-replace
- Delete: Delete by native MongoDB filter

## Type Coercion
ObjectId and Date values are automatically handled through and through. 

#### Input
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "orders": [
    {
      "productId": "66d6215f9b3c4a18e0f7a2c1",
      "quantity": 2,
      "timestamp": "2025-02-03T18:46:00Z"
    }
  ],
  "createdAt": "2024-01-15T10:44:00Z"
}
```

#### Saved DB Document
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "name": "John Doe",
   "orders": [
    {
      "productId": ObjectId("66d6215f9b3c4a18e0f7a2c1"),
      "quantity": 2,
      "timestamp": ISODate("2025-02-03T18:46:00Z")
    }
  ],
  "createdAt": ISODate("2024-01-15T10:44:00Z")
}
```

`$oid` and `$toDate` operators in pipelines are recognized and respected. Any manual type conversions you may already have in place will not be overwritten.

## Usage Examples

### Advanced Update with arrayFilters

```json
{
  "updateFilter": {"userId": "12345"},
  "update": {
    "$set": {
      "orders.$[elem].status": "shipped",
      "orders.$[elem].shippedAt": "2024-01-15T10:00:00Z"
    }
  },
  "arrayFilters": [{"elem.status": "pending"}],
  "many": false
}
```

### Update Pipeline

```json
{
  "updateFilter": {"_id": {"$oid": "507f1f77bcf86cd799439011"}},
  "update": [
    {"$set": {
      "totalSpent": {"$add": ["$totalSpent", "$currentOrder.amount"]},
      "lastOrderDate": "$$NOW",
      "orderCount": {"$add": ["$orderCount", 1]}
    }}
  ]
}
```

### Aggregation Pipeline

```json
[
  {"$match": {"status": "active"}},
  {"$lookup": {
    "from": "orders",
    "localField": "_id",
    "foreignField": "userId",
    "as": "userOrders"
  }},
  {"$group": {
    "_id": "$department",
    "totalOrders": {"$sum": {"$size": "$userOrders"}},
    "avgOrderValue": {"$avg": "$userOrders.total"}
  }}
]
```

### Bulk Insert with Type Coercion

```json
{
  "document": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "createdAt": "2024-01-15T10:00:00Z",
      "name": "John Doe"
    },
    {
      "_id": "507f1f77bcf86cd799439012",
      "createdAt": "2024-01-15T11:00:00Z",
      "name": "Jane Smith"
    }
  ],
  "many": true
}
```

## Compatibility

- n8n >= 0.187.0
- Node.js >= 20.15
- MongoDB >= 4.4

## License

[MIT](./LICENSE.md)
