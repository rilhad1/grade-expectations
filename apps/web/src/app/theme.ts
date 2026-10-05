import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: { main: '#1F3A5F' },
    background: { default: '#F7F5F0', paper: '#FFFFFF' },
    text: { primary: '#1F2328' },
  },
  shape: { borderRadius: 6 },
  typography: { fontFamily: '"Golos UI", Inter, system-ui, sans-serif', fontSize: 14 },
});
