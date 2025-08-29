import type { INodeProperties } from 'n8n-workflow';

export const nodeProperties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Search Index',
				value: 'searchIndexes',
			},
			{
				name: 'Document',
				value: 'document',
			},
		],
		default: 'document',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['document'],
			},
		},
		options: [
			{
				name: 'Aggregate',
				value: 'aggregate',
				description: 'Aggregate documents',
				action: 'Aggregate documents',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete documents',
				action: 'Delete documents',
			},
			{
				name: 'Find',
				value: 'find',
				description: 'Find documents',
				action: 'Find documents',
			},
			{
				name: 'Find And Replace',
				value: 'findOneAndReplace',
				description: 'Find and replace documents',
				action: 'Find and replace documents',
			},
			{
				name: 'Find And Update',
				value: 'findOneAndUpdate',
				description: 'Find and update documents',
				action: 'Find and update documents',
			},
			{
				name: 'Insert',
				value: 'insert',
				description: 'Insert documents',
				action: 'Insert documents',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update documents',
				action: 'Update documents',
			}
		],
		default: 'find',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['searchIndexes'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'createSearchIndex',
				action: 'Create Search Index',
			},
			{
				name: 'Drop',
				value: 'dropSearchIndex',
				action: 'Drop Search Index',
			},
			{
				name: 'List',
				value: 'listSearchIndexes',
				action: 'List Search Indexes',
			},
			{
				name: 'Update',
				value: 'updateSearchIndex',
				action: 'Update Search Index',
			},
		],
		default: 'createSearchIndex',
	},
	{
		displayName: 'Collection',
		name: 'collection',
		type: 'string',
		required: true,
		default: '',
		description: 'MongoDB Collection',
	},

	// ----------------------------------
	//         aggregate
	// ----------------------------------
	{
		displayName: 'Query',
		name: 'query',
		type: 'json',
		typeOptions: {
			alwaysOpenEditWindow: true,
		},
		displayOptions: {
			show: {
				operation: ['aggregate'],
				resource: ['document'],
			},
		},
		default: '',
		placeholder: '[{ "$match": { "$gt": "1950-01-01" }, ... }]',
		hint: 'Learn more about aggregation pipeline <a href="https://docs.mongodb.com/manual/core/aggregation-pipeline/">here</a>',
		required: true,
		description: 'MongoDB aggregation pipeline query in JSON format',


	},

	// ----------------------------------
	//         delete
	// ----------------------------------
	{
		displayName: 'Delete Query (JSON Format)',
		name: 'query',
		type: 'json',
		typeOptions: {
			rows: 5,
		},
		displayOptions: {
			show: {
				operation: ['delete'],
				resource: ['document'],
			},
		},
		default: '{}',
		placeholder: '{ "birth": { "$gt": "1950-01-01" } }',
		required: true,
		description: 'MongoDB Delete query',
	},

	// ----------------------------------
	//         find
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		displayOptions: {
			show: {
				operation: ['find'],
				resource: ['document'],
			},
		},
		default: {},
		placeholder: 'Add option',
		description: 'Add query options',
		options: [
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 0,
				// eslint-disable-next-line n8n-nodes-base/node-param-description-wrong-for-limit
				description:
					'Use limit to specify the maximum number of documents or 0 for unlimited documents',
			},
			{
				displayName: 'Skip',
				name: 'skip',
				type: 'number',
				default: 0,
				description: 'The number of documents to skip in the results set',
			},
			{
				displayName: 'Sort (JSON Format)',
				name: 'sort',
				type: 'json',
				typeOptions: {
					rows: 2,
				},
				default: '{}',
				placeholder: '{ "field": -1 }',
				description: 'A JSON that defines the sort order of the result set',
			},
			{
				displayName: 'Projection (JSON Format)',
				name: 'projection',
				type: 'json',
				typeOptions: {
					rows: 4,
				},
				default: '{}',
				placeholder: '{ "_id": 0, "field": 1 }',
				description:
					'A JSON that defines a selection of fields to retrieve or exclude from the result set',
			},
		],
	},
	{
		displayName: 'Query (JSON Format)',
		name: 'query',
		type: 'json',
		typeOptions: {
			rows: 5,
		},
		displayOptions: {
			show: {
				operation: ['find'],
				resource: ['document'],
			},
		},
		default: '{}',
		placeholder: '{ "birth": { "$gt": "1950-01-01" } }',
		required: true,
		description: 'MongoDB Find query',
	},

	// ----------------------------------
	//         insert
	// ----------------------------------
	{
		displayName: 'Document',
		name: 'document',
		type: 'json',
		displayOptions: {
			show: {
				operation: ['insert', 'findOneAndReplace'],
				resource: ['document'],
			},
		},
		default: '',
		required: true,
		placeholder: '{ "name": "{{$json.name}}", "description": "{{$json.description}}" }',
		description: 'Provide the document to insert. When "Many" is enabled, supply an array of documents for insertMany.',
	},

	// ----------------------------------
	//         update
	// ----------------------------------
	{
		displayName: 'Update Filter',
		name: 'updateFilter',
		type: 'json',
		displayOptions: {
			show: {
				operation: ['update', 'findOneAndReplace', 'findOneAndUpdate'],
				resource: ['document'],
			},
		},
		default: '{"_id": { $oid: "{{$json.id}}" }}',
		required: true,
		description:
			'MongoDB filter object that determines which documents should be updated. You can construct complex filters using MongoDB query operators. Example: {"_id": "{{$json.id}}"} or {"status": "active", "age": {"$gte": 18}}',
	},
	{
		displayName: 'Update',
		name: 'update',
		type: 'json',
		displayOptions: {
			show: {
				operation: ['update', 'findOneAndUpdate'],
				resource: ['document'],
			},
		},
		default: '',
		placeholder: '{"$set": {"name": "{{$json.name}}" }, "$inc": { "counter": 1 } }',
		description:
			'Provide a MongoDB update definition. You can configure a full update object (e.g. {$set, $unset, $inc, ...}) or an update pipeline (array of stages) as supported by MongoDB.',
	},
	{
		displayName: 'Upsert',
		name: 'upsert',
		type: 'boolean',
		displayOptions: {
			show: {
				operation: ['update', 'findOneAndReplace', 'findOneAndUpdate'],
				resource: ['document'],
			},
		},
		default: false,
		description: 'Whether to perform an insert if no documents match the update key',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		displayOptions: {
			show: {
				operation: ['update', 'insert', 'findOneAndReplace', 'findOneAndUpdate'],
				resource: ['document'],
			},
		},
		placeholder: 'Add option',
		default: {},
		options: [
			{
				displayName: 'Many',
				name: 'many',
				type: 'boolean',
				displayOptions: {
					show: {
						operation: ['insert', 'update'],
						resource: ['document'],
					},
				},
				default: false,
				description:
					'When enabled, perform a multi-document operation: insertMany (for Insert) or updateMany (for Update). If disabled, uses insertOne/updateOne.',
			},			
			{
				displayName: 'Array Filters',
				name: 'arrayFilters',
				type: 'json',
				default: '',
				placeholder: '[{ "elem.status": "pending" }]',
				description:
					'MongoDB arrayFilters to control which array elements get updated using positional operators like $[elem]. Example: [{ "elem.status": "pending" }].',
				displayOptions: {
					show: {
						operation: ['update', 'findOneAndUpdate'],
						resource: ['document'],
					},
				},
			},		
			{
				displayName: 'Hint',
				name: 'hint',
				type: 'string',
				default: '',
				description: 'Index name to use for query optimization',
			}
		],
	},
	{
		displayName: 'Index Name',
		name: 'indexName',
		type: 'string',
		displayOptions: {
			show: {
				operation: ['listSearchIndexes'],
				resource: ['searchIndexes'],
			},
		},
		default: '',
		description: 'If provided, only lists indexes with the specified name',
	},
	{
		displayName: 'Index Name',
		name: 'indexNameRequired',
		type: 'string',
		displayOptions: {
			show: {
				operation: ['createSearchIndex', 'dropSearchIndex', 'updateSearchIndex'],
				resource: ['searchIndexes'],
			},
		},
		default: '',
		required: true,
		description: 'The name of the search index',
	},
	{
		displayName: 'Index Definition',
		name: 'indexDefinition',
		type: 'json',
		displayOptions: {
			show: {
				operation: ['createSearchIndex', 'updateSearchIndex'],
				resource: ['searchIndexes'],
			},
		},
		typeOptions: {
			alwaysOpenEditWindow: true,
		},
		placeholder: '{ "type": "vectorSearch", "definition": {} }',
		hint: 'Learn more about search index definitions <a href="https://www.mongodb.com/docs/atlas/atlas-search/index-definitions/">here</a>',
		default: '{}',
		required: true,
		description: 'The search index definition',
	},
	{
		displayName: 'Index Type',
		name: 'indexType',
		type: 'options',
		displayOptions: {
			show: {
				operation: ['createSearchIndex'],
				resource: ['searchIndexes'],
			},
		},
		options: [
			{
				value: 'vectorSearch',
				name: 'Vector Search',
			},
			{
				name: 'Search',
				value: 'search',
			},
		],
		default: 'vectorSearch',
		required: true,
		description: 'The search index index type',
	},
];
