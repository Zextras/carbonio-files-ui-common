/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { faker } from '@faker-js/faker';
import filter from 'lodash/filter';
import find from 'lodash/find';
import map from 'lodash/map';
import some from 'lodash/some';

import { CONFIGS, NODES_LOAD_LIMIT, NODES_SORT_DEFAULT, ROOTS } from '../constants';
import { SortableNode } from '../types/common';
import {
	Config,
	DistributionList,
	File as FilesFile,
	Folder,
	Link,
	Maybe,
	Node,
	NodePage,
	NodeSort,
	NodeType,
	Permissions,
	Share,
	SharedTarget,
	SharePermission,
	User
} from '../types/graphql/types';
import { ContactMatch } from '../types/network';
import { ActionsFactoryNodeType } from '../utils/ActionsFactory';
import { nodeSortComparator } from '../utils/utils';

type NodeTypename = FilesFile['__typename'] | Folder['__typename'];

export function sortNodes(
	nodes: Array<Maybe<SortableNode>>,
	sort: NodeSort
): Array<Maybe<SortableNode>> {
	const sortsList =
		sort === NodeSort.SizeAsc || sort === NodeSort.SizeDesc ? [sort] : [NodeSort.TypeAsc, sort];
	return nodes.sort((a, b) => nodeSortComparator(a, b, sortsList));
}

export function populateUser(id?: string, name?: string): User {
	return {
		id: id || faker.datatype.uuid(),
		email: faker.internet.exampleEmail(name),
		full_name: name || faker.name.findName(),
		__typename: 'User'
	};
}

export function populateDistributionList(limit = 10, id = '', name = ''): DistributionList {
	const users = [];
	for (let i = 0; i < faker.datatype.number(limit); i += 1) {
		users.push(populateUser(undefined, `user${i}`));
	}
	return {
		__typename: 'DistributionList',
		id: id || faker.datatype.uuid(),
		name: name || faker.name.jobArea(),
		users
	};
}

export function populatePermissions(grantAll = false): Permissions {
	return {
		can_read: true,
		can_write_file: grantAll || faker.datatype.boolean(),
		can_write_folder: grantAll || faker.datatype.boolean(),
		can_delete: grantAll || faker.datatype.boolean(),
		can_add_version: grantAll || faker.datatype.boolean(),
		can_read_link: grantAll || faker.datatype.boolean(),
		can_change_link: grantAll || faker.datatype.boolean(),
		can_share: grantAll || faker.datatype.boolean(),
		can_read_share: grantAll || faker.datatype.boolean(),
		can_change_share: grantAll || faker.datatype.boolean(),
		__typename: 'Permissions'
	};
}

export function populateSharePermission(sharePermission?: SharePermission): SharePermission {
	return sharePermission || SharePermission.ReadAndWrite;
}

export function populateShare(node: Node, key: number | string, shareTarget?: SharedTarget): Share {
	return {
		__typename: 'Share',
		created_at: faker.date.past().getTime(),
		node,
		share_target:
			shareTarget ||
			faker.helpers.arrayElement([
				populateUser(undefined, `share_target_user_${key}`),
				populateDistributionList(undefined, undefined, `share_target_dl_${key}`)
			]),
		permission: populateSharePermission(),
		expires_at: faker.datatype.datetime().getTime()
	};
}

export function populateShares(node: FilesFile | Folder, limit = 1): Share[] {
	const shares: Share[] = [];
	const nodeRef: Pick<FilesFile | Folder, 'id' | 'type' | '__typename'> = {
		id: node.id,
		type: node.type,
		__typename: node.__typename
	};
	for (let i = 0; i < limit; i += 1) {
		shares.push(populateShare(nodeRef as Node, i));
	}
	return shares;
}

function populateNodeFields(type?: NodeType, id?: string, name?: string): Node {
	const types = filter(Object.values(NodeType), (t) => t !== NodeType.Root);
	const nodeType = type || faker.helpers.arrayElement(types);
	return {
		id: id || faker.datatype.uuid(),
		creator: populateUser(),
		owner: populateUser('me', 'Me Myself'),
		last_editor: populateUser(),
		created_at: faker.date.past().getTime(),
		updated_at: faker.date.recent().getTime(),
		permissions: populatePermissions(),
		name: name || faker.random.words(),
		description: faker.lorem.paragraph(),
		type: (id && some(ROOTS, (root) => root === id) && NodeType.Root) || nodeType,
		flagged: faker.datatype.boolean(),
		rootId: (id && find(ROOTS, (root) => root === id)) || ROOTS.LOCAL_ROOT,
		parent: null,
		share: null,
		shares: [],
		links: []
	};
}

export function populateUnknownNode(
	id?: string,
	name?: string
): Partial<Node> & ActionsFactoryNodeType {
	return {
		id: id || faker.datatype.uuid(),
		creator: populateUser(),
		owner: populateUser(),
		last_editor: populateUser(),
		created_at: faker.date.past().getTime(),
		updated_at: faker.date.recent().getTime(),
		permissions: populatePermissions(),
		name: name || faker.random.words(),
		description: '',
		type: NodeType.Other,
		flagged: faker.datatype.boolean(),
		rootId: ROOTS.LOCAL_ROOT,
		parent: null,
		share: null,
		shares: [],
		links: []
	};
}

export function getRandomNodeType(): NodeTypename {
	const types: Array<NodeTypename> = ['File', 'Folder'];
	return types[Math.floor(Math.random() * types.length)];
}

export function populateNode(type?: NodeTypename, id?: string, name?: string): FilesFile | Folder {
	let __typename = type;
	if (!__typename) {
		__typename = getRandomNodeType();
	}

	switch (__typename) {
		case 'File':
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			return populateFile(id, name);
		case 'Folder':
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			return populateFolder(0, id, name);
		default:
			throw new TypeError(`${__typename} is not a valid type`);
	}
}

export function populateNodes(limit?: number, type?: NodeTypename): Node[] {
	const nodesLength = limit || 100;
	const nodes: Node[] = [];
	for (let i = 0; i < nodesLength; i += 1) {
		const node = populateNode(type);
		node.name = `n${i} - ${node.name}`;
		nodes.push(node);
	}
	return nodes;
}

export function populateFolder(
	childrenLimit = 0,
	id = '',
	name = '',
	sort = NODES_SORT_DEFAULT
): Folder {
	const children: Node[] = [];
	let folderName = name;
	let type = NodeType.Folder;
	if (id === ROOTS.LOCAL_ROOT && !name) {
		folderName = 'ROOT';
	}
	if (some(ROOTS, (root) => root === id)) {
		type = NodeType.Root;
	}
	const folder: Folder = {
		...populateNodeFields(type, id, folderName),
		children,
		__typename: 'Folder'
	};
	if (!folder.id.includes('LOCAL')) {
		folder.shares = populateShares(folder, faker.datatype.number(10));
	}
	for (let i = 0; i < childrenLimit; i += 1) {
		const child = populateNode();
		child.parent = { ...folder, children: [] } as Folder;
		child.name = `child-${i} - ${child.name}`;
		children.push(child);
	}
	sortNodes(folder.children, sort);
	return folder;
}

export function populateLocalRoot(childrenLimit = 0): Folder {
	return populateFolder(childrenLimit, ROOTS.LOCAL_ROOT, 'ROOT');
}

export function populateParents(
	node: Node,
	limit = 1,
	withRoot = false
): { node: Node; path: Node[] } {
	let currentNode = node;
	const path = [currentNode];
	const parentsLimit = withRoot ? limit - 1 : limit;
	if (node.id !== ROOTS.LOCAL_ROOT) {
		for (let i = 0; i < parentsLimit; i += 1) {
			currentNode.parent = populateFolder(0, undefined, `parent${i}`);
			path.unshift(currentNode.parent);
			currentNode = currentNode.parent;
		}
	}
	if (withRoot) {
		currentNode.parent = populateLocalRoot();
		path.unshift(currentNode.parent);
	}
	return {
		node,
		path
	};
}

export function incrementVersion(inputFile: FilesFile, changeLastEditor = false): FilesFile {
	const result = { ...inputFile };
	if (result.version) {
		result.version += 1;
	} else {
		result.version = 1;
	}
	if (changeLastEditor) {
		result.last_editor = populateUser();
	}
	return result;
}

export function getVersionFromFile(
	inputFile: FilesFile
): Pick<
	FilesFile,
	'version' | 'size' | 'last_editor' | 'updated_at' | 'keep_forever' | 'cloned_from_version'
> {
	return {
		version: inputFile.version,
		size: inputFile.size,
		last_editor: inputFile.last_editor,
		updated_at: inputFile.updated_at,
		keep_forever: inputFile.keep_forever,
		cloned_from_version: inputFile.cloned_from_version
	};
}

export function populateFile(id?: string, name?: string): FilesFile {
	const mimeType = faker.system.mimeType();
	const types = filter(
		Object.values(NodeType),
		(t) => t !== NodeType.Root && t !== NodeType.Folder
	);
	const file: FilesFile = {
		...populateNodeFields(faker.helpers.arrayElement(types), id, name),
		mime_type: mimeType,
		size: faker.datatype.number(),
		extension: faker.system.commonFileExt(),
		version: 1,
		parent: populateFolder(),
		keep_forever: faker.datatype.boolean(),
		cloned_from_version: null,
		__typename: 'File'
	};
	file.shares = populateShares(file, faker.datatype.number(10));
	return file;
}

export function populateNodePage(nodes: Node[], pageSize: number = NODES_LOAD_LIMIT): NodePage {
	return {
		__typename: 'NodePage',
		nodes,
		page_token: nodes.length === pageSize ? 'next_page_token' : null
	};
}

export function populateContact(fullName?: string, email?: string): ContactMatch {
	return {
		id: faker.datatype.uuid(),
		email: email || faker.internet.exampleEmail(fullName),
		full: fullName || faker.name.findName()
	};
}

export function populateLink(node: Node): Link {
	return {
		__typename: 'Link',
		id: faker.datatype.uuid(),
		created_at: faker.date.recent().getTime(),
		expires_at: faker.helpers.arrayElement([
			null,
			faker.date.soon().getTime(),
			faker.date.future().getTime()
		]),
		description: faker.helpers.arrayElement([null, faker.lorem.sentence()]),
		url: faker.internet.url(),
		node
	};
}

export function populateLinks(node: Node, limit = 2): Link[] {
	const links = [];
	for (let i = 0; i < limit; i += 1) {
		const link = populateLink(node);
		links.push(link);
	}
	return links;
}

export function populateConfigs(configMap?: Record<string, string>): Config[] {
	const defaultConfigs: Record<typeof CONFIGS[keyof typeof CONFIGS], string> = {
		[CONFIGS.MAX_VERSIONS]: '5',
		[CONFIGS.MAX_KEEP_VERSIONS]: '3'
	};
	const configs = { ...defaultConfigs, ...configMap };
	return map(configs, (configValue, configName) => ({ name: configName, value: configValue }));
}
