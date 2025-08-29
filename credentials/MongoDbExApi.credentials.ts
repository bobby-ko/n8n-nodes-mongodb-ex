import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class MongoDbExApi implements ICredentialType {
	name = 'mongoDbExApi';
	displayName = 'MongoDB Ex API';
	properties: INodeProperties[] = [
		{
			displayName: 'Connection String (URI)',
			name: 'connectionString',
			type: 'string',
			default: '',
			placeholder: 'mongodb+srv://user:pass@cluster0.mongodb.net/?retryWrites=true&w=majority',
			required: true,
			description: 'Full MongoDB connection URI. You can include auth, db, and options in the URI.',
		},
		{
			displayName: 'Database',
			name: 'database',
			type: 'string',
			default: '',
			required: true,
			description: 'Database name to use when not specified in the URI',
		},
	];
}

