import {
  chakra,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
} from "@chakra-ui/react";
import { LanguageIcon } from "@heroicons/react/24/outline";
import { FC, ReactNode } from "react";
import { useTranslation } from "react-i18next";

type HeaderProps = {
  actions?: ReactNode;
};

const LangIcon = chakra(LanguageIcon, {
  baseStyle: {
    w: 4,
    h: 4,
  },
});

export const Language: FC<HeaderProps> = ({ actions }) => {
  const { i18n } = useTranslation();

  return (
    <Menu placement="bottom-end">
      <MenuButton
        as={IconButton}
        size="sm"
        variant="outline"
        icon={<LangIcon />}
        position="relative"
      />
      <MenuList minW="100px" zIndex={9999}>
        <MenuItem
          maxW="100px"
          fontSize="sm"
          onClick={() => i18n.changeLanguage("en")}
        >
          English
        </MenuItem>
      </MenuList>
    </Menu>
  );
};
