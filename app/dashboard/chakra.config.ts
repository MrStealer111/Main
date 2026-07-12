import { extendTheme } from "@chakra-ui/react";
export const theme = extendTheme({
  shadows: { outline: "0 0 0 2px var(--chakra-colors-primary-200)" },
  fonts: {
    body: `Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,Fira Sans,Droid Sans,Helvetica Neue,sans-serif`,
  },
  colors: {
    "light-border": "#d2d2d4",
    primary: {
      50: "#a5f3fc",
      100: "#67e8f9",
      200: "#22d3ee",
      300: "#06b6d4",
      400: "#0891b2",
      500: "#0e7490",
      600: "#155e75",
      700: "#164e63",
      800: "#083344",
      900: "#042f2e",
    },
    gray: {
      750: "#1a1f2e",
    },
  },
  components: {
    Alert: {
      baseStyle: {
        container: {
          borderRadius: "12px",
          fontSize: "sm",
        },
      },
    },
    Select: {
      baseStyle: {
        field: {
          _dark: {
            borderColor: "gray.600",
            borderRadius: "12px",
          },
          _light: {
            borderRadius: "12px",
          },
        },
      },
    },
    FormHelperText: {
      baseStyle: {
        fontSize: "xs",
      },
    },
    FormLabel: {
      baseStyle: {
        fontSize: "sm",
        fontWeight: "medium",
        mb: "1",
        _dark: { color: "gray.300" },
      },
    },
    Input: {
      baseStyle: {
        addon: {
          _dark: {
            borderColor: "gray.600",
            _placeholder: {
              color: "gray.500",
            },
          },
        },
        field: {
          _focusVisible: {
            boxShadow: "none",
            borderColor: "primary.300",
            outlineColor: "primary.300",
          },
          _dark: {
            borderColor: "gray.600",
            _disabled: {
              color: "gray.400",
              borderColor: "gray.500",
            },
            _placeholder: {
              color: "gray.500",
            },
          },
        },
      },
    },
    Table: {
      baseStyle: {
        table: {
          borderCollapse: "separate",
          borderSpacing: 0,
        },
        thead: {
          borderBottomColor: "light-border",
        },
        th: {
          background: "gray.750",
          borderColor: "light-border !important",
          borderBottomColor: "light-border !important",
          borderTop: "1px solid ",
          borderTopColor: "light-border !important",
          _first: {
            borderLeft: "1px solid",
            borderColor: "light-border !important",
          },
          _last: {
            borderRight: "1px solid",
            borderColor: "light-border !important",
          },
          _dark: {
            borderColor: "gray.600 !important",
            background: "gray.750",
          },
        },
        td: {
          transition: "all .1s ease-out",
          borderColor: "light-border",
          borderBottomColor: "light-border !important",
          _first: {
            borderLeft: "1px solid",
            borderColor: "light-border",
            _dark: {
              borderColor: "gray.600",
            },
          },
          _last: {
            borderRight: "1px solid",
            borderColor: "light-border",
            _dark: {
              borderColor: "gray.600",
            },
          },
          _dark: {
            borderColor: "gray.600",
            borderBottomColor: "gray.600 !important",
          },
        },
        tr: {
          "&.interactive": {
            cursor: "pointer",
            _hover: {
              "& > td": {
                bg: "gray.750",
              },
              _dark: {
                "& > td": {
                  bg: "gray.750",
                },
              },
            },
          },
          _last: {
            "& > td": {
              _first: {
                borderBottomLeftRadius: "8px",
              },
              _last: {
                borderBottomRightRadius: "8px",
              },
            },
          },
        },
      },
    },
  },
});
