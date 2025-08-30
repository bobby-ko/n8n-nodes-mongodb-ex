import get from 'lodash-es/get';
import set from 'lodash-es/set';

import { MongoClient, ObjectId, type Document } from 'mongodb';
import { NodeOperationError } from 'n8n-workflow';
import type {
	ICredentialDataDecryptedObject,
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
} from 'n8n-workflow';
import { createSecureContext } from 'tls';

import type {
	IMongoCredentials,
	IMongoCredentialsType,
	IMongoParametricCredentials,
} from './mongoDb.types';
// import { formatPrivateKey } from '../../utils/utilities';

const isoRegex = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|[+\-]\d{2}:\d{2})?)?$/;

function formatPrivateKey(privateKey: string, keyIsPublic = false): string {
	let regex = /(PRIVATE KEY|CERTIFICATE)/;
	if (keyIsPublic) {
		regex = /(PUBLIC KEY)/;
	}
	if (!privateKey || /\n/.test(privateKey)) {
		return privateKey;
	}
	let formattedPrivateKey = '';
	const parts = privateKey.split('-----').filter((item) => item !== '');
	parts.forEach((part) => {
		if (regex.test(part)) {
			formattedPrivateKey += `-----${part}-----`;
		} else {
			const passRegex = /Proc-Type|DEK-Info/;
			if (passRegex.test(part)) {
				part = part.replace(/:\s+/g, ':');
				formattedPrivateKey += part.replace(/\\n/g, '\n').replace(/\s+/g, '\n');
			} else {
				formattedPrivateKey += part.replace(/\\n/g, '\n').replace(/\s+/g, '\n');
			}
		}
	});
	return formattedPrivateKey;
}

/**
 * Standard way of building the MongoDB connection string, unless overridden with a provided string
 *
 * @param {ICredentialDataDecryptedObject} credentials MongoDB credentials to use, unless conn string is overridden
 */
export function buildParameterizedConnString(credentials: IMongoParametricCredentials): string {
	if (credentials.port) {
		return `mongodb://${credentials.user}:${credentials.password}@${credentials.host}:${credentials.port}`;
	} else {
		return `mongodb+srv://${credentials.user}:${credentials.password}@${credentials.host}`;
	}
}

/**
 * Build mongoDb connection string and resolve database name.
 * If a connection string override value is provided, that will be used in place of individual args
 *
 * @param {ICredentialDataDecryptedObject} credentials raw/input MongoDB credentials to use
 */
export function buildMongoConnectionParams(
	self: IExecuteFunctions,
	credentials: IMongoCredentialsType,
): IMongoCredentials {
	const sanitizedDbName =
		credentials.database && credentials.database.trim().length > 0
			? credentials.database.trim()
			: '';
	if (credentials.configurationType === 'connectionString') {
		if (credentials.connectionString && credentials.connectionString.trim().length > 0) {
			return {
				connectionString: credentials.connectionString.trim(),
				database: sanitizedDbName,
			};
		} else {
			throw new NodeOperationError(
				self.getNode(),
				'Cannot override credentials: valid MongoDB connection string not provided ',
			);
		}
	} else {
		return {
			connectionString: buildParameterizedConnString(credentials),
			database: sanitizedDbName,
		};
	}
}

/**
 * Verify credentials. If ok, build mongoDb connection string and resolve database name.
 *
 * @param {ICredentialDataDecryptedObject} credentials raw/input MongoDB credentials to use
 */
export function validateAndResolveMongoCredentials(
	self: IExecuteFunctions,
	credentials?: ICredentialDataDecryptedObject,
): IMongoCredentials {
	if (credentials === undefined) {
		throw new NodeOperationError(self.getNode(), 'No credentials got returned!');
	} else {
		return buildMongoConnectionParams(self, credentials as unknown as IMongoCredentialsType);
	}
}

export function prepareItems({
	items,
	fields,
	updateKey = '',
	useDotNotation = false,
	dateFields = [],
	isUpdate = false,
}: {
	items: INodeExecutionData[];
	fields: string[];
	updateKey?: string;
	useDotNotation?: boolean;
	dateFields?: string[];
	isUpdate?: boolean;
}) {
	let data = items;

	if (updateKey) {
		if (!fields.includes(updateKey)) {
			fields.push(updateKey);
		}
		data = items.filter((item) => item.json[updateKey] !== undefined);
	}

	const preparedItems = data.map(({ json }) => {
		const updateItem: IDataObject = {};

		for (const field of fields) {
			let fieldData;

			if (useDotNotation) {
				fieldData = get(json, field, null);
			} else {
				fieldData = json[field] !== undefined ? json[field] : null;
			}

			if (fieldData && dateFields.includes(field)) {
				fieldData = new Date(fieldData as string);
			}

			if (useDotNotation && !isUpdate) {
				set(updateItem, field, fieldData);
			} else {
				updateItem[field] = fieldData;
			}
		}

		return updateItem;
	});

	return preparedItems;
}

export function prepareFields(fields: string) {
	return fields
		.split(',')
		.map((field) => field.trim())
		.filter((field) => !!field);
}

export function stringifyObjectIDs(items: INodeExecutionData[]) {
	items.forEach((item: any) => {
		if (item._id instanceof ObjectId) {
			item.json._id = item._id.toString();
		}
		if (item.id instanceof ObjectId) {
			item.json.id = item.id.toString();
		}
	});

	return items;
}

export async function connectMongoClient(connectionString: string, credentials: IDataObject = {}) {
	let client: MongoClient;

	if (credentials.tls) {
		const ca = credentials.ca ? formatPrivateKey(credentials.ca as string) : undefined;
		const cert = credentials.cert ? formatPrivateKey(credentials.cert as string) : undefined;
		const key = credentials.key ? formatPrivateKey(credentials.key as string) : undefined;
		const passphrase = (credentials.passphrase as string) || undefined;

		const secureContext = createSecureContext({
			ca,
			cert,
			key,
			passphrase,
		});

		client = await MongoClient.connect(connectionString, {
			tls: true,
			secureContext,
		} as any);
	} else {
		client = await MongoClient.connect(connectionString);
	}

	return client;
}


// ------------------------------
// Type coercion helpers
// ------------------------------
function isISODateString(value: string): boolean {
	// Accepts formats like YYYY-MM-DD, or full ISO 8601 with time and zone
	return isoRegex.test(value);
}

function traverseAndCoerce(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((v) => traverseAndCoerce(v));
	}
	if (value !== null && typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		// Do not traverse into special extended/operator shapes
		if (Object.prototype.hasOwnProperty.call(obj, '$oid') || Object.prototype.hasOwnProperty.call(obj, '$toDate')) {
			return obj;
		}
		for (const key of Object.keys(obj)) {
			if (['$oid', '$toDate'].includes(key)) continue; // ignore these keys entirely
			obj[key] = traverseAndCoerce(obj[key]);
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
		if (isISODateString(str)) {
			const d = new Date(str);
			if (!Number.isNaN(d.getTime())) return d;
		}
	}
	return value;
}

export function coerceDocumentTypes(document: Document): Document {
	return traverseAndCoerce(document) as Document;
}
