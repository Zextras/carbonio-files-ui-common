/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable arrow-body-style */
import React, { useCallback, useMemo, useState } from 'react';

import { FetchResult } from '@apollo/client';
import { Text, Tooltip } from '@zextras/carbonio-design-system';
import filter from 'lodash/filter';
import map from 'lodash/map';
import { useTranslation } from 'react-i18next';

import { useActiveNode } from '../../../../hooks/useActiveNode';
import { SHARE_CHIP_SIZE } from '../../../constants';
import { useDeleteShareMutation } from '../../../hooks/graphql/mutations/useDeleteShareMutation';
import { useUpdateShareMutation } from '../../../hooks/graphql/mutations/useUpdateShareMutation';
import { useDeleteShareModal } from '../../../hooks/useDeleteShareModal';
import { ChipActionsType, Role } from '../../../types/common';
import {
	DeleteNodesMutation,
	File,
	Folder,
	Node,
	NodeType,
	Permissions,
	Share,
	SharedTarget,
	SharePermission
} from '../../../types/graphql/types';
import { isFile, isFolder } from '../../../utils/ActionsFactory';
import { getChipLabel, sharePermissionsGetter } from '../../../utils/utils';
import { ChipWithPopover } from './ChipWithPopover';
import { EditShareChipPopoverContainer } from './EditShareChipPopoverContainer';

const rowSharePermissionToIdxMap = {
	[SharePermission.ReadOnly]: 0,
	[SharePermission.ReadAndShare]: 0,
	[SharePermission.ReadAndWrite]: 1,
	[SharePermission.ReadWriteAndShare]: 1
};

const rowRoleToIdxMap: { [Role.Editor]: number; [Role.Viewer]: number } = {
	[Role.Viewer]: 0,
	[Role.Editor]: 1
};

const roleAssignChecker: {
	[Role.Editor]: (node: Node, permissions: Permissions) => boolean;
	[Role.Viewer]: (node: Node, permissions: Permissions) => boolean;
} = {
	[Role.Editor]: (node: Node, permissions: Permissions) =>
		(node.type === NodeType.Folder && permissions.can_write_folder) ||
		(node.type !== NodeType.Folder && permissions.can_write_file),
	[Role.Viewer]: () => true
};

const rowIdxToRoleMap: { [id: number]: Role } = {
	0: Role.Viewer,
	1: Role.Editor
};

interface EditShareChipProps {
	share: Share;
	permissions: Permissions;
	yourselfChip: boolean;
}

export const EditShareChip: React.FC<EditShareChipProps> = ({
	/** Chip value */
	share,
	permissions,
	yourselfChip = false
}) => {
	const [updateShare] = useUpdateShareMutation();
	const [t] = useTranslation();
	const { activeNodeId, removeActiveNode } = useActiveNode();

	const initialActiveRow = useMemo(() => rowSharePermissionToIdxMap[share.permission], [share]);
	const initialCheckboxValue = useMemo(
		() =>
			share.permission === SharePermission.ReadAndShare ||
			share.permission === SharePermission.ReadWriteAndShare,
		[share]
	);

	const [activeRow, setActiveRow] = useState(initialActiveRow);
	const [checkboxValue, setCheckboxValue] = useState(initialCheckboxValue);

	const switchSharingAllowed = (): void => {
		setCheckboxValue((prevState) => !prevState);
	};

	const changeRole = (containerIdx: number): void => {
		const desiredRole: Role = rowIdxToRoleMap[containerIdx];
		if (
			desiredRole !== Role.Editor ||
			// if desiredRole === Role.Editor you need write permission
			(isFolder(share.node as File | Folder) && permissions.can_write_folder) ||
			(isFile(share.node as File | Folder) && permissions.can_write_file)
		) {
			setActiveRow(containerIdx);
		}
	};

	const updateShareCallback = useCallback(() => {
		updateShare(
			share.node,
			share.share_target?.id as string,
			sharePermissionsGetter(rowIdxToRoleMap[activeRow], checkboxValue)
		).then((_result) => {
			// console.log(_result);
		});
	}, [activeRow, checkboxValue, share, updateShare]);

	const deleteShare = useDeleteShareMutation();

	const deleteShareCallback = useCallback<() => Promise<FetchResult<DeleteNodesMutation>>>(
		(): Promise<FetchResult<DeleteNodesMutation>> =>
			deleteShare(share.node, (share.share_target as SharedTarget).id),
		[deleteShare, share]
	);

	// remove active when deleted share to avoid having an un-accessible node as active
	const navigateToSharedWithMe = useCallback(() => {
		if (yourselfChip && share.node.id === activeNodeId) {
			removeActiveNode();
		}
	}, [activeNodeId, removeActiveNode, share.node.id, yourselfChip]);

	const { openDeleteShareModal } = useDeleteShareModal(
		deleteShareCallback,
		share.share_target as SharedTarget,
		yourselfChip,
		navigateToSharedWithMe
	);

	const openDeleteShareModalCallback = useCallback(
		(ev) => {
			if (ev) {
				ev.stopPropagation();
			}
			openDeleteShareModal();
		},
		[openDeleteShareModal]
	);

	const disabledRows = useMemo(() => {
		const filtered = filter(
			rowIdxToRoleMap,
			(role) => !roleAssignChecker[role](share.node, permissions)
		);
		return map(filtered, (value: Role) => rowRoleToIdxMap[value]);
	}, [permissions, share]);

	const chipLabel = useMemo(
		() => (yourselfChip ? t('displayer.share.chip.you', 'You') : getChipLabel(share.share_target)),
		[yourselfChip, t, share.share_target]
	);

	const editChipTooltipLabel = useMemo(
		() =>
			yourselfChip
				? t('displayer.share.chip.tooltip.edit.you', 'Edit your collaboration')
				: t('displayer.share.chip.tooltip.edit.collaborator', "Edit {{username}}'s collaboration", {
						replace: { username: getChipLabel(share.share_target) }
				  }),
		[yourselfChip, share.share_target, t]
	);

	const actions: Array<ChipActionsType> = useMemo(() => {
		const icons: Array<ChipActionsType> = [];
		if (
			share.permission === SharePermission.ReadOnly ||
			share.permission === SharePermission.ReadAndShare
		) {
			icons.push({
				icon: 'EyeOutline',
				id: 'EyeOutline',
				type: 'icon',
				color: 'gray0',
				label: (permissions.can_share && editChipTooltipLabel) || undefined
			});
		} else {
			icons.push({
				icon: 'Edit2Outline',
				id: 'Edit2Outline',
				type: 'icon',
				color: 'gray0',
				label: (permissions.can_share && editChipTooltipLabel) || undefined
			});
		}
		if (
			share.permission === SharePermission.ReadAndShare ||
			share.permission === SharePermission.ReadWriteAndShare
		) {
			icons.push({
				icon: 'Share',
				id: 'Share',
				type: 'icon',
				color: 'gray0',
				label: (permissions.can_share && editChipTooltipLabel) || undefined
			});
		}

		const buttons: Array<ChipActionsType> = [];
		if (permissions.can_share || yourselfChip) {
			buttons.push({
				icon: 'Close',
				label: yourselfChip
					? t('displayer.share.chip.tooltip.remove.yourself', 'Remove your collaboration')
					: t('displayer.share.chip.tooltip.remove.collaborator', 'Remove {{username}}', {
							replace: { username: getChipLabel(share.share_target) }
					  }),
				id: 'Remove',
				type: 'button',
				color: 'gray0',
				onClick: openDeleteShareModalCallback
			});
		}
		return [...icons, ...buttons];
	}, [
		editChipTooltipLabel,
		openDeleteShareModalCallback,
		permissions.can_share,
		share.permission,
		share.share_target,
		t,
		yourselfChip
	]);

	const chipLabelComponent = useMemo(
		() => (
			<Tooltip
				label={permissions.can_share ? editChipTooltipLabel : chipLabel}
				maxWidth="100%"
				overflowTooltip={!permissions.can_share}
			>
				<Text size={SHARE_CHIP_SIZE} weight="light">
					{chipLabel}
				</Text>
			</Tooltip>
		),
		[chipLabel, editChipTooltipLabel, permissions.can_share]
	);

	return (
		<>
			<ChipWithPopover
				size={SHARE_CHIP_SIZE}
				avatarLabel={chipLabel}
				label={chipLabelComponent}
				background="gray3"
				actions={actions}
				openPopoverOnClick={permissions.can_share}
				maxWidth="210px"
			>
				{(closePopover: () => void): JSX.Element => (
					<EditShareChipPopoverContainer
						activeRow={activeRow}
						disabledRows={disabledRows}
						checkboxValue={checkboxValue}
						checkboxOnClick={switchSharingAllowed}
						containerOnClick={changeRole}
						saveDisabled={initialActiveRow === activeRow && initialCheckboxValue === checkboxValue}
						saveOnClick={updateShareCallback}
						closePopover={closePopover}
					/>
				)}
			</ChipWithPopover>
		</>
	);
};
