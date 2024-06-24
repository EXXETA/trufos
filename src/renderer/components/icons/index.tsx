import React from 'react';
import Icon from './Icon';

import { ReactComponent as AddSVG } from './add.svg';
import { ReactComponent as BookmarkSVG } from './bookmark.svg';
import { ReactComponent as CloseSVG } from './close.svg';
import { ReactComponent as DeleteSVG } from './delete.svg';
import { ReactComponent as GitHubSVG } from './gitHub.svg';
import { ReactComponent as InfoSVG } from './info.svg';
import { ReactComponent as SearchSVG } from './search.svg';
import { ReactComponent as SettingsSVG } from './settings.svg';
import { ReactComponent as SmallArrowDownSVG } from './smallArrowDown.svg';
import { ReactComponent as SmallArrowUp } from './smallArrowUp.svg';
import { ReactComponent as SwapVertSVG } from './swap_vert.svg';
import { ReactComponent as ArrowForwardSVG } from './arrow_forward.svg';

export const AddIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon Component={AddSVG} {...props} />;
export const BookmarksIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon Component={BookmarkSVG} {...props} />;
export const CloseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon Component={CloseSVG} {...props} />;
export const DeleteIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon Component={DeleteSVG} {...props} />;
export const GitHubIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon Component={GitHubSVG} {...props} />;
export const InfoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon Component={InfoSVG} {...props} />;
export const SearchIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon Component={SearchSVG} {...props} />;
export const SettingsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon Component={SettingsSVG} {...props} />;
export const ArrowDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon Component={SmallArrowDownSVG} {...props} />;
export const ArrowUpIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon Component={SmallArrowUp} {...props} />;
export const SwapIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon Component={SwapVertSVG} {...props} />;
export const ArrowForwardIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <Icon Component={ArrowForwardSVG} {...props} />;
