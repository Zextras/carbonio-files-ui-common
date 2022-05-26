/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useCallback } from 'react';

import { ApolloCache, FetchResult, NormalizedCacheObject, useMutation } from '@apollo/client';
import filter from 'lodash/filter';
import size from 'lodash/size';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import useUserInfo from '../../../../hooks/useUserInfo';
import PARENT_ID from '../../../graphql/fragments/parentId.graphql';
import SHARE_TARGET from '../../../graphql/fragments/shareTarget.graphql';
import DELETE_SHARE from '../../../graphql/mutations/deleteShare.graphql';
import { FindNodesCachedObject } from '../../../types/apollo';
import { PickIdNodeType } from '../../../types/common';
import {
	DeleteShareMutation,
	DeleteShareMutationVariables,
	DistributionList,
	Folder,
	ParentIdFragment,
	Share,
	SharedTarget,
	User
} from '../../../types/graphql/types';
import { isSearchView } from '../../../utils/utils';
import { useCreateSnackbar } from '../../useCreateSnackbar';
import { useErrorHandler } from '../../useErrorHandler';
import { useUpdateFolderContent } from '../useUpdateFolderContent';

function removeNodeFromFilter(
	cache: ApolloCache<NormalizedCacheObject>,
	nodeId: string,
	checkFilter: (existingNodesRefs: FindNodesCachedObject) => boolean = (): boolean => true
): void {
	cache.modify({
		fields: {
			findNodes(
				existingNodesRefs: FindNodesCachedObject | undefined,
				{ readField, DELETE }
			): FindNodesCachedObject | undefined {
				if (existingNodesRefs && checkFilter(existingNodesRefs)) {
					const ordered = filter(
						existingNodesRefs.nodes?.ordered,
						(orderedNode) => nodeId !== readField('id', orderedNode)
					);
					const unOrdered = filter(
						existingNodesRefs.nodes?.unOrdered,
						(unOrderedNode) => nodeId !== readField('id', unOrderedNode)
					);

					if (existingNodesRefs.page_token && size(ordered) === 0 && size(unOrdered) === 0) {
						return DELETE;
					}

					return {
						args: existingNodesRefs.args,
						page_token: existingNodesRefs.page_token,
						nodes: {
							ordered,
							unOrdered
						}
					};
				}
				// if no update is needed, return existing data (new requests are handled with navigation)
				return existingNodesRefs;
			}
		}
	});
}

/**
 * Mutation to delete share.
 * Can return error: ErrorCode.SHARE_NOT_FOUND
 */
export function useDeleteShareMutation(): (
	node: PickIdNodeType,
	shareTargetId: string
) => Promise<FetchResult<DeleteShareMutation>> {
	const createSnackbar = useCreateSnackbar();
	const { removeNodesFromFolder } = useUpdateFolderContent();
	const [t] = useTranslation();
	const { me } = useUserInfo();
	const location = useLocation();

	const [deleteShareMutation, { error }] = useMutation<
		DeleteShareMutation,
		DeleteShareMutationVariables
	>(DELETE_SHARE);

	useErrorHandler(error, 'DELETE_SHARE');

	const deleteShare: (
		node: PickIdNodeType,
		shareTargetId: string
	) => Promise<FetchResult<DeleteShareMutation>> = useCallback(
		(node: PickIdNodeType, shareTargetId: string) =>
			deleteShareMutation({
				variables: {
					node_id: node.id,
					share_target_id: shareTargetId
				},
				optimisticResponse: {
					__typename: 'Mutation',
					deleteShare: true
				},
				errorPolicy: 'all',
				update(cache, { data }) {
					if (data?.deleteShare) {
						cache.modify({
							id: cache.identify(node),
							fields: {
								shares(existingShareRefs: Share[]) {
									const updatedShares = filter(existingShareRefs, (existingShareRef) => {
										const sharedTarget: User | DistributionList | null | undefined =
											existingShareRef.share_target &&
											cache.readFragment<SharedTarget>({
												id: cache.identify(existingShareRef.share_target),
												fragment: SHARE_TARGET
											});
										return !(sharedTarget && sharedTarget.id === shareTargetId);
									});
									if (updatedShares.length === 0) {
										// remove node from shared by me when user remove all collaborators
										removeNodeFromFilter(
											cache,
											node.id,
											(existingNodesRefs) =>
												existingNodesRefs.args?.shared_by_me === true && !isSearchView(location)
										);
									}
									return updatedShares;
								}
							}
						});
						// remove node from shared with me when user remove self share
						if (shareTargetId === me) {
							removeNodeFromFilter(
								cache,
								node.id,
								(existingNodesRefs) => existingNodesRefs.args?.shared_with_me === true
							);

							const parentFolder = cache.readFragment<ParentIdFragment>({
								id: cache.identify(node),
								fragment: PARENT_ID
							});
							if (parentFolder?.parent) {
								removeNodesFromFolder(parentFolder.parent as Pick<Folder, '__typename' | 'id'>, [
									node.id
								]);
							}
						}
					}
				}
			}).then((result) => {
				if (result.data?.deleteShare) {
					createSnackbar({
						key: new Date().toLocaleString(),
						type: 'info',
						label: t('snackbar.deleteShare.success', 'Success'),
						replace: true,
						hideButton: true
					});
				}
				return result;
			}),
		[createSnackbar, deleteShareMutation, location, me, removeNodesFromFolder, t]
	);

	return deleteShare;
}
