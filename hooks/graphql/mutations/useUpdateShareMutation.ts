/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useCallback } from 'react';

import { ApolloError, FetchResult, useMutation } from '@apollo/client';
import reduce from 'lodash/reduce';

import SHARE_TARGET from '../../../graphql/fragments/shareTarget.graphql';
import UPDATE_SHARE from '../../../graphql/mutations/updateShare.graphql';
import { PickIdNodeType } from '../../../types/common';
import {
	Share,
	SharePermission,
	ShareTargetFragment,
	UpdateShareMutation,
	UpdateShareMutationVariables
} from '../../../types/graphql/types';
import { useErrorHandler } from '../../useErrorHandler';

export type UpdateShareType = (
	node: PickIdNodeType,
	shareTargetId: string,
	permission: SharePermission
) => Promise<FetchResult<UpdateShareMutation>>;

/**
 * Can return error: ErrorCode.SHARE_NOT_FOUND
 */
export function useUpdateShareMutation(): [
	updateShare: UpdateShareType,
	updateShareError: ApolloError | undefined
] {
	const [updateShareMutation, { error: updateShareError }] = useMutation<
		UpdateShareMutation,
		UpdateShareMutationVariables
	>(UPDATE_SHARE);

	const updateShare: UpdateShareType = useCallback(
		(node: PickIdNodeType, shareTargetId: string, permission: SharePermission) =>
			updateShareMutation({
				variables: {
					node_id: node.id,
					share_target_id: shareTargetId,
					permission
				},
				update(cache) {
					cache.modify({
						id: cache.identify(node),
						fields: {
							shares(existingShareRefs: Share[]) {
								const updatedShares = reduce(
									existingShareRefs,
									(accumulator: Share[], existingShareRef: Share) => {
										const sharedTarget =
											existingShareRef.share_target &&
											cache.readFragment<ShareTargetFragment>({
												id: cache.identify(existingShareRef.share_target),
												fragment: SHARE_TARGET
											});
										if (sharedTarget && sharedTarget.id === shareTargetId) {
											const newExistingShareRef = {
												...existingShareRef,
												permission
											};
											accumulator.push(newExistingShareRef);
											return accumulator;
										}
										accumulator.push(existingShareRef);
										return accumulator;
									},
									[]
								);

								return updatedShares;
							}
						}
					});
				}
			}),
		[updateShareMutation]
	);
	useErrorHandler(updateShareError, 'UPDATE_SHARE');

	return [updateShare, updateShareError];
}
