/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Container, Responsive, Snackbar } from '@zextras/carbonio-design-system';
import { ACTION_TYPES } from '@zextras/carbonio-shell-ui';
import noop from 'lodash/noop';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';

import { useCreateOptions } from '../../hooks/useCreateOptions';
import { useNavigation } from '../../hooks/useNavigation';
import { DISPLAYER_WIDTH, FILES_APP_ID, LIST_WIDTH, ROOTS } from '../constants';
import { ListContext } from '../contexts';
import { useUpload } from '../hooks/useUpload';
import { URLParams } from '../types/common';
import { inputElement } from '../utils/utils';
import { Displayer } from './components/Displayer';
import FilterList from './components/FilterList';

const FilterView: React.VFC = () => {
	const { filter } = useParams<URLParams>();
	const isFlaggedFilter = filter === 'flagged';
	const isMyTrashFilter = filter === 'myTrash';
	const isSharedTrashFilter = filter === 'sharedTrash';
	const isSharedByMeFilter = filter === 'sharedByMe';
	const isSharedWithMeFilter = filter === 'sharedWithMe';

	const { setCreateOptions } = useCreateOptions();
	const [t] = useTranslation();

	const { pathname, search } = useLocation();

	const { add } = useUpload();
	const { navigateToFolder } = useNavigation();
	const [showUploadSnackbar, setShowUploadSnackbar] = useState(false);
	const [isEmpty, setIsEmpty] = useState(false);

	const closeUploadSnackbar = useCallback(() => {
		setShowUploadSnackbar(false);
	}, []);

	const uploadSnackbarAction = useCallback(() => {
		navigateToFolder(ROOTS.LOCAL_ROOT);
	}, [navigateToFolder]);

	const inputElementOnchange = useCallback(
		(ev: Event) => {
			if (ev.currentTarget instanceof HTMLInputElement && ev.currentTarget.files) {
				add(ev.currentTarget.files, ROOTS.LOCAL_ROOT);
				// required to select 2 times the same file/files
				if (ev.target instanceof HTMLInputElement) {
					ev.target.value = '';
				}
				setShowUploadSnackbar(true);
			}
		},
		[add]
	);

	useEffect(() => {
		setCreateOptions(
			{
				id: 'upload-file',
				type: ACTION_TYPES.NEW,
				action: () => ({
					id: 'upload-file',
					primary: true,
					group: FILES_APP_ID,
					type: ACTION_TYPES.NEW,
					label: t('create.options.new.upload', 'Upload'),
					icon: 'CloudUploadOutline',
					click: (event): void => {
						// eslint-disable-next-line @typescript-eslint/ban-ts-comment
						// @ts-ignore
						event && event.stopPropagation();
						inputElement.click();
						inputElement.onchange = inputElementOnchange;
					}
				})
			},
			{
				id: 'create-folder',
				type: ACTION_TYPES.NEW,
				action: () => ({
					id: 'create-folder',
					group: FILES_APP_ID,
					type: ACTION_TYPES.NEW,
					label: t('create.options.new.folder', 'New Folder'),
					icon: 'FolderOutline',
					disabled: true,
					click: noop
				})
			},
			{
				id: 'create-docs-document',
				type: ACTION_TYPES.NEW,
				action: () => ({
					id: 'create-docs-document',
					group: FILES_APP_ID,
					type: ACTION_TYPES.NEW,
					label: t('create.options.new.document', 'New Document'),
					icon: 'FileTextOutline',
					disabled: true,
					click: noop
				})
			},
			{
				id: 'create-docs-spreadsheet',
				type: ACTION_TYPES.NEW,
				action: () => ({
					id: 'create-docs-spreadsheet',
					group: FILES_APP_ID,
					type: ACTION_TYPES.NEW,
					label: t('create.options.new.spreadsheet', 'New Spreadsheet'),
					icon: 'FileCalcOutline',
					disabled: true,
					click: noop
				})
			},
			{
				id: 'create-docs-presentation',
				type: ACTION_TYPES.NEW,
				action: () => ({
					id: 'create-docs-presentation',
					group: FILES_APP_ID,
					type: ACTION_TYPES.NEW,
					label: t('create.options.new.presentation', 'New Presentation'),
					icon: 'FilePresentationOutline',
					disabled: true,
					click: noop
				})
			}
		);
		return (): void => {
			setCreateOptions({
				id: 'upload-file',
				type: ACTION_TYPES.NEW,
				action: () => ({
					id: 'upload-file',
					primary: true,
					group: FILES_APP_ID,
					type: ACTION_TYPES.NEW,
					label: t('create.options.new.upload', 'Upload'),
					icon: 'CloudUploadOutline',
					click: (event): void => {
						// eslint-disable-next-line @typescript-eslint/ban-ts-comment
						// @ts-ignore
						event && event.stopPropagation();
						inputElement.click();
						inputElement.onchange = inputElementOnchange;
					},
					disabled: false
				})
			});
		};
	}, [filter, inputElementOnchange, pathname, search, setCreateOptions, t]);

	const displayerPlaceholdersKey = useMemo(() => {
		const filterKey = filter && filter.includes('Trash') ? 'trash' : filter;
		return `displayer.filter.${filterKey}`;
	}, [filter]);

	const ListComponent = useMemo(
		() =>
			(isFlaggedFilter && <FilterList flagged trashed={false} canUploadFile cascade />) ||
			(isSharedByMeFilter && (
				<FilterList sharedByMe trashed={false} canUploadFile cascade directShare />
			)) ||
			(isSharedWithMeFilter && (
				<FilterList sharedWithMe trashed={false} canUploadFile cascade directShare />
			)) ||
			(isMyTrashFilter && (
				<FilterList trashed sharedWithMe={false} canUploadFile={false} cascade={false} />
			)) ||
			(isSharedTrashFilter && (
				<FilterList trashed sharedWithMe canUploadFile={false} cascade={false} />
			)) || <Container>Missing Filter</Container>,
		[
			isFlaggedFilter,
			isMyTrashFilter,
			isSharedByMeFilter,
			isSharedTrashFilter,
			isSharedWithMeFilter
		]
	);

	return (
		<ListContext.Provider value={{ isEmpty, setIsEmpty }}>
			<Container
				orientation="row"
				crossAlignment="flex-start"
				mainAlignment="flex-start"
				width="fill"
				height="fill"
				background="gray5"
				borderRadius="none"
				maxHeight="100%"
			>
				<Responsive mode="desktop" target={window.top}>
					<Container
						width={LIST_WIDTH}
						mainAlignment="flex-start"
						crossAlignment="unset"
						borderRadius="none"
						background="gray6"
					>
						{ListComponent}
					</Container>
					<Container
						width={DISPLAYER_WIDTH}
						mainAlignment="flex-start"
						crossAlignment="flex-start"
						borderRadius="none"
						style={{ maxHeight: '100%' }}
					>
						<Displayer translationKey={displayerPlaceholdersKey} />
					</Container>
				</Responsive>
				<Responsive mode="mobile" target={window.top}>
					{ListComponent}
				</Responsive>
			</Container>
			<Snackbar
				open={showUploadSnackbar}
				onClose={closeUploadSnackbar}
				type="info"
				label={t('uploads.destination.home', "Upload occurred in Files' Home")}
				actionLabel={t('snackbar.upload.goToFolder', 'Go to folder')}
				onActionClick={uploadSnackbarAction}
			/>
		</ListContext.Provider>
	);
};

export default FilterView;
