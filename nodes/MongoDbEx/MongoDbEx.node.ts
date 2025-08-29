import type {
	FindOneAndReplaceOptions,
	FindOneAndUpdateOptions,
	UpdateOptions,
	Sort,
	Document,
} from 'mongodb';
import { ObjectId } from 'mongodb';
import { ApplicationError /*, NodeConnectionTypes */ } from 'n8n-workflow';
import type {
	IExecuteFunctions,
	ICredentialsDecrypted,
	ICredentialTestFunctions,
	IDataObject,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	IPairedItemData,
} from 'n8n-workflow';

import {
	buildParameterizedConnString,
	connectMongoClient,
	stringifyObjectIDs,
	validateAndResolveMongoCredentials,
} from './GenericFunctions';
import type { IMongoParametricCredentials } from './mongoDb.types';
import { nodeProperties } from './MongoDbProperties';
// import { generatePairedItemData } from '../../utils/utilities';

function generatePairedItemData(length: number): IPairedItemData[] {
	return Array.from({ length }, (_, item) => ({
		item,
	}));
}

export class MongoDbEx implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MongoDB Ex',
		name: 'mongoDbEx',
		icon: 'file:mongodb.svg',
		group: ['input'],
		version: [1, 1.1, 1.2],
		description: 'MongoDB Extended - Advanced MongoDB operations, including support for filters, bulk operations, full update json support and more.',
		defaults: {
			name: 'MongoDB Ex',
		},
		inputs: ['main'] as any,  //[NodeConnectionTypes.Main],
		outputs: ['main'] as any, // [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'mongoDb',
				required: true,
				testedBy: 'mongoDbCredentialTest',
			},
		],
		properties: nodeProperties,
	};

	methods = {
		credentialTest: {
			async mongoDbCredentialTest(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const credentials = credential.data as IDataObject;

				try {
					const database = ((credentials.database as string) || '').trim();
					let connectionString = '';

					if (credentials.configurationType === 'connectionString') {
						connectionString = ((credentials.connectionString as string) || '').trim();
					} else {
						connectionString = buildParameterizedConnString(
							credentials as unknown as IMongoParametricCredentials,
						);
					}

					const client = await connectMongoClient(connectionString, credentials);

					const { databases } = await client.db().admin().listDatabases();

					if (!(databases as IDataObject[]).map((db) => db.name).includes(database)) {
						throw new ApplicationError(`Database "${database}" does not exist`, {
							level: 'warning',
						});
					}
					await client.close();
				} catch (error) {
					return {
						status: 'Error',
						message: (error as Error).message,
					};
				}
				return {
					status: 'OK',
					message: 'Connection successful!',
				};
			},
		},
	};


	// Traverse a document and coerce string values that look like ObjectId or ISO dates
	private isISODateString(value: string): boolean {
		// Accepts formats like YYYY-MM-DD, or full ISO 8601 with time and zone
		const isoRegex = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|[+\-]\d{2}:\d{2})?)?$/;
		return isoRegex.test(value);
	}

	private traverseAndCoerce(value: unknown): unknown {
		if (Array.isArray(value)) {
			return value.map((v) => this.traverseAndCoerce(v));
		}
		if (value !== null && typeof value === 'object') {
			const obj = value as Record<string, unknown>;
			// Do not traverse into special extended/operator shapes
			if (Object.prototype.hasOwnProperty.call(obj, '$oid') || Object.prototype.hasOwnProperty.call(obj, '$toDate')) {
				return obj;
			}
			for (const key of Object.keys(obj)) {
				if (['$oid', '$toDate'].includes(key)) continue; // ignore these keys entirely
				obj[key] = this.traverseAndCoerce(obj[key]);
			}
			return obj;
		}
		if (typeof value === 'string') {
			const str = value.trim();
			if (str.length === 24 && ObjectId.isValid(str)) {
				try {
					return ObjectId.createFromHexString(str);
				} catch {}
			}
			if (this.isISODateString(str)) {
				const d = new Date(str);
				if (!Number.isNaN(d.getTime())) return d;
			}
		}
		return value;
	}

	private coerceDocumentTypes(document: Document): Document {
		return this.traverseAndCoerce(document) as Document;
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const credentials = await this.getCredentials('mongoDb');
		const { database, connectionString } = validateAndResolveMongoCredentials(this, credentials);
		const client = await connectMongoClient(connectionString, credentials);
		let returnData: INodeExecutionData[] = [];

		try {
			const mdb = client.db(database);

			const items = this.getInputData();
			const operation = this.getNodeParameter('operation', 0);
			const nodeVersion = this.getNode().typeVersion;

			let itemsLength = items.length ? 1 : 0;
			let fallbackPairedItems: IPairedItemData[] | null = null;

			if (nodeVersion >= 1.1) {
				itemsLength = items.length;
			} else {
				fallbackPairedItems = generatePairedItemData(items.length);
			}

			if (operation === 'aggregate') {
				for (let i = 0; i < itemsLength; i++) {
					try {
						const pipelineRaw = this.getNodeParameter('query', i) as string;
						const pipelineParsed = JSON.parse(pipelineRaw) as unknown;
						const coercedPipeline = (this as unknown as MongoDbEx).coerceDocumentTypes(
							pipelineParsed as unknown as Document,
						) as unknown as Document[];
						const query = mdb
							.collection(this.getNodeParameter('collection', i) as string)
							.aggregate(coercedPipeline);

						for (const entry of await query.toArray()) {
							returnData.push({ json: entry, pairedItem: fallbackPairedItems ?? [{ item: i }] });
						}
					} catch (error) {
						if (this.continueOnFail()) {
							returnData.push({
								json: { error: (error as JsonObject).message },
								pairedItem: fallbackPairedItems ?? [{ item: i }],
							});
							continue;
						}
						throw error;
					}
				}
			}

			if (operation === 'delete') {
				for (let i = 0; i < itemsLength; i++) {
					try {
						const filterRaw = this.getNodeParameter('query', i) as string;
						const filterParsed = JSON.parse(filterRaw) as unknown as Document;
						const coercedFilter = (this as unknown as MongoDbEx).coerceDocumentTypes(filterParsed);
						const { deletedCount } = await mdb
							.collection(this.getNodeParameter('collection', i) as string)
							.deleteMany(coercedFilter);

						returnData.push({
							json: { deletedCount },
							pairedItem: fallbackPairedItems ?? [{ item: i }],
						});
					} catch (error) {
						if (this.continueOnFail()) {
							returnData.push({
								json: { error: (error as JsonObject).message },
								pairedItem: fallbackPairedItems ?? [{ item: i }],
							});
							continue;
						}
						throw error;
					}
				}
			}

			if (operation === 'find') {
				for (let i = 0; i < itemsLength; i++) {
					try {
						const queryRaw = this.getNodeParameter('query', i) as string;
						const queryParsed = JSON.parse(queryRaw) as unknown as Document;
						const coercedQuery = (this as unknown as MongoDbEx).coerceDocumentTypes(queryParsed);

						let query = mdb
							.collection(this.getNodeParameter('collection', i) as string)
							.find(coercedQuery);

						const options = this.getNodeParameter('options', i);
						const limit = options.limit as number;
						const skip = options.skip as number;
						const projection =
							options.projection && (JSON.parse(options.projection as string) as Document);
						const sort = options.sort && (JSON.parse(options.sort as string) as Sort);

						if (skip > 0) {
							query = query.skip(skip);
						}
						if (limit > 0) {
							query = query.limit(limit);
						}
						if (sort && Object.keys(sort).length !== 0 && sort.constructor === Object) {
							query = query.sort(sort);
						}

						if (
							projection &&
							Object.keys(projection).length !== 0 &&
							projection.constructor === Object
						) {
							query = query.project(projection);
						}

						const queryResult = await query.toArray();

						for (const entry of queryResult) {
							returnData.push({ json: entry, pairedItem: fallbackPairedItems ?? [{ item: i }] });
						}
					} catch (error) {
						if (this.continueOnFail()) {
							returnData.push({
								json: { error: (error as JsonObject).message },
								pairedItem: fallbackPairedItems ?? [{ item: i }],
							});
							continue;
						}
						throw error;
					}
				}
			}

			if (operation === 'findOneAndReplace') {
				fallbackPairedItems = fallbackPairedItems ?? generatePairedItemData(items.length);
				const updateOptions = (this.getNodeParameter('upsert', 0) as boolean)
					? { upsert: true }
					: undefined;

				const updatesToReturn: IDataObject[] = [];

				for (let i = 0; i < itemsLength; i++) {
					try {
						const updateFilterRaw = this.getNodeParameter('updateFilter', i) as string;
						const updateFilterParsed = JSON.parse(updateFilterRaw) as unknown as Document;
						const filter = (this as unknown as MongoDbEx).coerceDocumentTypes(updateFilterParsed);

						const updateRaw = this.getNodeParameter('update', i) as string;
						const replacement = (this as unknown as MongoDbEx).coerceDocumentTypes(
							JSON.parse(updateRaw) as unknown as Document,
						) as unknown as IDataObject | unknown[];

						await mdb
							.collection(this.getNodeParameter('collection', i) as string)
							.findOneAndReplace(filter as Document, replacement as Document, updateOptions as FindOneAndReplaceOptions);

						const payload = Array.isArray(replacement)
							? ({ updatePipeline: replacement } as unknown as IDataObject)
							: ((replacement as IDataObject) || {});
						updatesToReturn.push(payload);
					} catch (error) {
						if (this.continueOnFail()) {
							updatesToReturn.push({ error: (error as JsonObject).message });
							continue;
						}
						throw error;
					}
				}

				returnData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(updatesToReturn),
					{ itemData: fallbackPairedItems },
				);
			}

			if (operation === 'findOneAndUpdate') {
				fallbackPairedItems = fallbackPairedItems ?? generatePairedItemData(items.length);
				const baseUpdateOptions = (this.getNodeParameter('upsert', 0) as boolean)
					? { upsert: true }
					: undefined;

				const updatesToReturn: IDataObject[] = [];

				for (let i = 0; i < itemsLength; i++) {
					try {
						const updateFilterRaw = this.getNodeParameter('updateFilter', i) as string;
						const updateFilterParsed = JSON.parse(updateFilterRaw) as unknown as Document;
						const filter = (this as unknown as MongoDbEx).coerceDocumentTypes(updateFilterParsed);

						const updateRaw = this.getNodeParameter('update', i) as string;
						const updateDocOrPipeline = (this as unknown as MongoDbEx).coerceDocumentTypes(
							JSON.parse(updateRaw) as unknown as Document,
						) as unknown as IDataObject | unknown[];

						const arrayFiltersRaw = this.getNodeParameter('options.arrayFilters', i, '') as string;
						const arrayFilters = arrayFiltersRaw
							? ((this as unknown as MongoDbEx).coerceDocumentTypes(JSON.parse(arrayFiltersRaw) as unknown as Document) as unknown as Document[])
							: undefined;

						await mdb
							.collection(this.getNodeParameter('collection', i) as string)
							.findOneAndUpdate(
								filter as Document,
								updateDocOrPipeline as unknown as Document,
								({ ...(baseUpdateOptions || {}), ...(arrayFilters ? { arrayFilters } : {}) } as FindOneAndUpdateOptions),
							);

						const payload = Array.isArray(updateDocOrPipeline)
							? ({ updatePipeline: updateDocOrPipeline } as unknown as IDataObject)
							: ((updateDocOrPipeline as IDataObject) || {});
						updatesToReturn.push(payload);
					} catch (error) {
						if (this.continueOnFail()) {
							updatesToReturn.push({ error: (error as JsonObject).message });
							continue;
						}
						throw error;
					}
				}

				returnData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(updatesToReturn),
					{ itemData: fallbackPairedItems },
				);
			}

			if (operation === 'insert') {
				fallbackPairedItems = fallbackPairedItems ?? generatePairedItemData(items.length);
				let responseData: IDataObject[] = [];
				try {
					// Prepare the data to insert
					const many = this.getNodeParameter('many', 0, false) as boolean;
					const collection = mdb.collection(this.getNodeParameter('collection', 0) as string);

					const raw = this.getNodeParameter('document', 0) as unknown;
					const insertItems = Array.isArray(raw)
						? (raw as IDataObject[])
						: [typeof raw === 'string' ? (JSON.parse(raw as string) as IDataObject) : (raw as IDataObject)];

					if (many && !Array.isArray(raw)) {
						throw new ApplicationError('For many=true, the "Document" parameter must be an array of documents');
					}

					// Coerce types (ObjectId, ISO Date) within each document prior to insert
					const coercedItems = insertItems.map((doc) =>
						(this as unknown as MongoDbEx).coerceDocumentTypes(doc as unknown as Document) as unknown as IDataObject,
					);

					if (many) {
						const { insertedIds } = await collection.insertMany(coercedItems as unknown as Document[]);
						for (const i of Object.keys(insertedIds)) {
							responseData.push({
								...coercedItems[parseInt(i, 10)],
								id: insertedIds[parseInt(i, 10)] as unknown as string,
							});
						}
					} else {
						for (const item of coercedItems) {
							const { insertedId } = await collection.insertOne(item as unknown as Document);
							responseData.push({ ...item, id: insertedId as unknown as string });
						}
					}
				} catch (error) {
					if (this.continueOnFail()) {
						responseData = [{ error: (error as JsonObject).message }];
					} else {
						throw error;
					}
				}

				returnData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData),
					{ itemData: fallbackPairedItems },
				);
			}

			if (operation === 'update') {


				fallbackPairedItems = fallbackPairedItems ?? generatePairedItemData(items.length);
				const baseUpdateOptions = (this.getNodeParameter('upsert', 0) as boolean)
					? { upsert: true }
					: undefined;

				const updatesToReturn: IDataObject[] = [];

				for (let i = 0; i < itemsLength; i++) {
					try {
						const updateFilterRaw = this.getNodeParameter('updateFilter', i) as string;
						const updateFilterParsed = JSON.parse(updateFilterRaw) as unknown as Document;
						const filter = (this as unknown as MongoDbEx).coerceDocumentTypes(updateFilterParsed);

						const rawUpdateParam = this.getNodeParameter('update', i) as unknown;
						let updateDocOrPipeline = (typeof rawUpdateParam === 'string'
							? ((this as unknown as MongoDbEx).coerceDocumentTypes(JSON.parse(rawUpdateParam as string) as unknown as Document) as unknown as IDataObject | unknown[])
							: ((this as unknown as MongoDbEx).coerceDocumentTypes(rawUpdateParam as unknown as Document) as unknown as IDataObject | unknown[]));

						// For updateOne: if user provides a plain object without operators, wrap into {$set: ...}
						let updateArg: Document | Document[];
						if (Array.isArray(updateDocOrPipeline)) {
							updateArg = updateDocOrPipeline as unknown as Document[];
						} else {
							const obj = (updateDocOrPipeline as IDataObject) || {};
							const hasOperator = Object.keys(obj).some((k) => k.startsWith('$'));
							updateArg = (hasOperator ? obj : ({ $set: obj } as IDataObject)) as unknown as Document;
						}

						const many = this.getNodeParameter('many', i, false) as boolean;
						const collection = mdb.collection(this.getNodeParameter('collection', i) as string);
						const arrayFiltersRaw = this.getNodeParameter('arrayFilters', i, '') as string;
						const arrayFilters = arrayFiltersRaw
							? ((this as unknown as MongoDbEx).coerceDocumentTypes(JSON.parse(arrayFiltersRaw) as unknown as Document) as unknown as Document[])
							: undefined;

						if (many) {
							await collection.updateMany(
								filter as Document,
								updateArg as unknown as Document,
								({ ...(baseUpdateOptions || {}), ...(arrayFilters ? { arrayFilters } : {}) } as UpdateOptions),
							);
						} else {
							await collection.updateOne(
								filter as Document,
								updateArg as unknown as Document,
								({ ...(baseUpdateOptions || {}), ...(arrayFilters ? { arrayFilters } : {}) } as UpdateOptions),
							);
						}

						const payload = Array.isArray(updateDocOrPipeline)
							? ({ updatePipeline: updateDocOrPipeline } as unknown as IDataObject)
							: ((updateDocOrPipeline as IDataObject) || {});
						updatesToReturn.push(payload);
					} catch (error) {
						if (this.continueOnFail()) {
							updatesToReturn.push({ error: (error as JsonObject).message });
							continue;
						}
						throw error;
					}
				}

				returnData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(updatesToReturn),
					{ itemData: fallbackPairedItems },
				);
			}

			if (operation === 'listSearchIndexes') {
				for (let i = 0; i < itemsLength; i++) {
					try {
						const collection = this.getNodeParameter('collection', i) as string;
						const indexName = (() => {
							const name = this.getNodeParameter('indexName', i) as string;
							return name.length === 0 ? undefined : name;
						})();

						const cursor = indexName
							? mdb.collection(collection).listSearchIndexes(indexName)
							: mdb.collection(collection).listSearchIndexes();

						const query = await cursor.toArray();
						const result = query.map((json: any) => ({
							json,
							pairedItem: fallbackPairedItems ?? [{ item: i }],
						}));
						returnData.push(...result);
					} catch (error) {
						if (this.continueOnFail()) {
							returnData.push({
								json: { error: (error as JsonObject).message },
								pairedItem: fallbackPairedItems ?? [{ item: i }],
							});
							continue;
						}
						throw error;
					}
				}
			}

			if (operation === 'dropSearchIndex') {
				for (let i = 0; i < itemsLength; i++) {
					try {
						const collection = this.getNodeParameter('collection', i) as string;
						const indexName = this.getNodeParameter('indexNameRequired', i) as string;

						await mdb.collection(collection).dropSearchIndex(indexName);
						returnData.push({
							json: {
								[indexName]: true,
							},
							pairedItem: fallbackPairedItems ?? [{ item: i }],
						});
					} catch (error) {
						if (this.continueOnFail()) {
							returnData.push({
								json: { error: (error as JsonObject).message },
								pairedItem: fallbackPairedItems ?? [{ item: i }],
							});
							continue;
						}
						throw error;
					}
				}
			}

			if (operation === 'createSearchIndex') {
				for (let i = 0; i < itemsLength; i++) {
					try {
						const collection = this.getNodeParameter('collection', i) as string;
						const indexName = this.getNodeParameter('indexNameRequired', i) as string;
						const definition = JSON.parse(
							this.getNodeParameter('indexDefinition', i) as string,
						) as Record<string, unknown>;

						await mdb.collection(collection).createSearchIndex({
							name: indexName,
							definition,
						});

						returnData.push({
							json: { indexName },
							pairedItem: fallbackPairedItems ?? [{ item: i }],
						});
					} catch (error) {
						if (this.continueOnFail()) {
							returnData.push({
								json: { error: (error as JsonObject).message },
								pairedItem: fallbackPairedItems ?? [{ item: i }],
							});
							continue;
						}
						throw error;
					}
				}
			}

			if (operation === 'updateSearchIndex') {
				for (let i = 0; i < itemsLength; i++) {
					try {
						const collection = this.getNodeParameter('collection', i) as string;
						const indexName = this.getNodeParameter('indexNameRequired', i) as string;
						const definition = JSON.parse(
							this.getNodeParameter('indexDefinition', i) as string,
						) as Record<string, unknown>;

						await mdb.collection(collection).updateSearchIndex(indexName, definition);

						returnData.push({
							json: { [indexName]: true },
							pairedItem: fallbackPairedItems ?? [{ item: i }],
						});
					} catch (error) {
						if (this.continueOnFail()) {
							returnData.push({
								json: { error: (error as JsonObject).message },
								pairedItem: fallbackPairedItems ?? [{ item: i }],
							});
							continue;
						}
						throw error;
					}
				}
			}
		} finally {
			await client.close().catch(() => { });
		}

		return [stringifyObjectIDs(returnData)];
	}
}
