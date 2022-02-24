/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useEffect, useState } from 'react';

import { Container, Responsive, Snackbar } from '@zextras/carbonio-design-system';
// eslint-disable-next-line import/no-unresolved
import { ACTION_TYPES } from '@zextras/carbonio-shell-ui';
import noop from 'lodash/noop';
import { useTranslation } from 'react-i18next';

import { useCreateOptions } from '../../hooks/useCreateOptions';
import { useNavigation } from '../../hooks/useNavigation';
import { DISPLAYER_WIDTH, FILES_APP_ID, LIST_WIDTH, ROOTS } from '../constants';
import { ListContext } from '../contexts';
import { useUpload } from '../hooks/useUpload';
import { inputElement } from '../utils/utils';
import { Displayer } from './components/Displayer';
import { SearchList } from './components/SearchList';

interface SearchViewProps {
	resultsHeader?: React.ReactNode;
	listWidth?: string;
	displayerWidth?: string;
}

export const SearchView: React.VFC<SearchViewProps> = ({
	resultsHeader,
	listWidth = LIST_WIDTH,
	displayerWidth = DISPLAYER_WIDTH
}) => {
	const [t] = useTranslation();
	const { setCreateOptions } = useCreateOptions();
	const { navigateToFolder } = useNavigation();

	const { add } = useUpload();

	const [showUploadSnackbar, setShowUploadSnackbar] = useState(false);
	const [isEmpty, setIsEmpty] = useState(false);
	const [searchExecuted, setSearchExecuted] = useState(false);

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
				type: ACTION_TYPES.NEW,
				id: 'upload-file',
				action: () => ({
					type: ACTION_TYPES.NEW,
					id: 'upload-file',
					primary: true,
					group: FILES_APP_ID,
					label: t('create.options.new.upload', 'Upload'),
					icon: 'CloudUploadOutline',
					click: (event): void => {
						event && event.stopPropagation();
						inputElement.click();
						inputElement.onchange = inputElementOnchange;
					},
					disabled: false
				})
			},
			{
				type: ACTION_TYPES.NEW,
				id: 'create-folder',
				action: () => ({
					type: ACTION_TYPES.NEW,
					id: 'create-folder',
					group: FILES_APP_ID,
					label: t('create.options.new.folder', 'New Folder'),
					icon: 'FolderOutline',
					disabled: true,
					click: noop
				})
			},
			{
				type: ACTION_TYPES.NEW,
				id: 'create-docs-document',
				action: () => ({
					type: ACTION_TYPES.NEW,
					group: FILES_APP_ID,
					id: 'create-docs-document',
					label: t('create.options.new.document', 'New Document'),
					icon: 'FileTextOutline',
					disabled: true,
					click: noop
				})
			},
			{
				type: ACTION_TYPES.NEW,
				id: 'create-docs-spreadsheet',
				action: () => ({
					type: ACTION_TYPES.NEW,
					group: FILES_APP_ID,
					id: 'create-docs-spreadsheet',
					label: t('create.options.new.spreadsheet', 'New Spreadsheet'),
					icon: 'FileCalcOutline',
					disabled: true,
					click: noop
				})
			},
			{
				type: ACTION_TYPES.NEW,
				id: 'create-docs-presentation',
				action: () => ({
					type: ACTION_TYPES.NEW,
					group: FILES_APP_ID,
					id: 'create-docs-presentation',
					label: t('create.options.new.presentation', 'New Presentation'),
					icon: 'FilePresentationOutline',
					disabled: true,
					click: noop
				})
			}
		);
		return (): void => {
			setCreateOptions({
				type: ACTION_TYPES.NEW,
				id: 'upload-file',
				action: () => ({
					type: ACTION_TYPES.NEW,
					group: FILES_APP_ID,
					id: 'upload-file',
					primary: true,
					label: t('create.options.new.upload', 'Upload'),
					icon: 'CloudUploadOutline',
					click: (event): void => {
						event && event.stopPropagation();
						inputElement.click();
						inputElement.onchange = inputElementOnchange;
					},
					disabled: false
				})
			});
		};
	}, [inputElementOnchange, navigateToFolder, setCreateOptions, t]);

	return (
		<ListContext.Provider
			value={{
				isEmpty,
				setIsEmpty,
				queryCalled: searchExecuted,
				setQueryCalled: setSearchExecuted
			}}
		>
			<Container minHeght={0} maxHeight="100%" mainAlignment="flex-start">
				{resultsHeader}
				<Container
					orientation="horizontal"
					crossAlignment="flex-start"
					mainAlignment="flex-start"
					width="fill"
					height="fill"
					background="gray5"
					borderRadius="none"
					maxHeight="100%"
					minHeight={0}
				>
					<Responsive mode="desktop" target={window.top}>
						<Container
							width={listWidth}
							mainAlignment="flex-start"
							crossAlignment="unset"
							borderRadius="none"
							background="gray6"
						>
							<SearchList />
						</Container>
						<Container
							width={displayerWidth}
							mainAlignment="flex-start"
							crossAlignment="flex-start"
							borderRadius="none"
							style={{ maxHeight: '100%' }}
						>
							<Displayer translationKey="displayer.search" icons={['SearchOutline']} />
						</Container>
					</Responsive>
					<Responsive mode="mobile" target={window.top}>
						<SearchList />
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
			</Container>
		</ListContext.Provider>
	);
};
