import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import CssBaseline from '@mui/material/CssBaseline';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import StorePage from './StorePage';
import { Divider } from '@mui/material';

const drawerWidth = 250;

// Map stores on their audits
export interface StoreInfo {
  name: string,
  site: string,
  audit: string,
  logo: string,
}

const stores: StoreInfo[] = [{
  name: "The Drinks Center",
  site: "http://localhost:5002/",
  audit: "http://localhost:5123/audit",
  logo: "store.jpg"
}]

export default function ClippedDrawer() {

  const [selected, setSelected] = useState<StoreInfo | undefined>(undefined)

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            Auto Auditing Platform
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>

            <ListItem key='registered' disablePadding>
              <ListItemButton>
                <ListItemText primary="Registered Stores" />
              </ListItemButton>
            </ListItem>
            <Divider />
            {stores.map((store, index) => (
              <ListItem key={store.name} onClick={() => setSelected(store)} disablePadding
                className={selected && selected?.name === store.name ? "selected" : ""} >
                <ListItemButton>
                  <ListItemIcon>
                    <img src={store.logo} style={{width: "2rem", height: "2rem"}} />
                  </ListItemIcon>
                  <ListItemText primary={store.name} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box id="contents" component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {
          selected && <StorePage store={selected} />
        }
      </Box>
    </Box>
  );
}