/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import faker from 'faker';
import { GraphQLContext, GraphQLRequest, ResponseResolver } from 'msw';

import { ROOTS } from '../constants';
import { GetNodeLinksQuery, GetNodeLinksQueryVariables } from '../types/graphql/types';
import { populateLinks, populateNode } from './mockUtils';

const handleGetNodeLinksRequest: ResponseResolver<
	GraphQLRequest<GetNodeLinksQueryVariables>,
	GraphQLContext<GetNodeLinksQuery>,
	GetNodeLinksQuery
> = (req, res, ctx) => {
	const { nodeId: id } = req.variables;

	let nodeName = faker.random.words();
	if (id.trim() === ROOTS.LOCAL_ROOT) {
		nodeName = 'ROOT';
	}
	const node = populateNode(undefined, id, nodeName);

	const linksLimit = faker.datatype.number({ min: 0, max: 50 });
	node.links = populateLinks({ ...node, links: [] }, linksLimit);

	return res(
		ctx.data({
			getNode: node
		})
	);
};

export default handleGetNodeLinksRequest;
