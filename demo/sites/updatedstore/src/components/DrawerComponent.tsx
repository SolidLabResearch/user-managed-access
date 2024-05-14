import * as React from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { Badge } from '@mui/material';
import UserCartComponent from './UserCartComponent';


export default function TemporaryDrawer({ 
  cartCourses, 
  deleteCartCourses, 
  setCartCourses, 
  badgeCounter,
  ageValidated,
  verify,
  handlePayment
}: {
  cartCourses: any, 
  deleteCartCourses: any, 
  setCartCourses: any,
  badgeCounter: number,
  ageValidated: boolean,
  verify: Function
  handlePayment: Function,
}) {
  const [open, setOpen] = React.useState(false);
  console.log(cartCourses)

  

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  const DrawerList = (
    <Box sx={{ width: 500 }} role="presentation" > 
      <UserCartComponent
        cartCourses={cartCourses}
        deleteCartCourses={deleteCartCourses}
        setCartCourses={setCartCourses}
        ageValidated={ageValidated}
        verify={verify}
        handlePayment={handlePayment}
      />
    </Box>
  );

  return (
    <div>
      <div id="shopping-cart-wrapper" className='icon-wrap' onClick={toggleDrawer(true)}>
        <Badge id='shopping-cart-badge' badgeContent={badgeCounter} color="primary">
          <ShoppingCartIcon id='shopping-cart-icon' color="action" />
        </Badge>
      </div>
      <Drawer anchor='right' open={open} onClose={toggleDrawer(false)}>
        {DrawerList}
      </Drawer>
    </div>
  );
}