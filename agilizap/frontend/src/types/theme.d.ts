import type { CSSProperties } from "@material-ui/styles/withStyles";
import "@material-ui/core/styles/createTheme";

declare module "@material-ui/core/styles/createTheme" {
  interface Theme {
    scrollbarStyles?: CSSProperties;
  }
}
