import { Button, TextField } from '@mui/material'
import * as React from 'react'
import { CartItem } from '../App'

function PaymentComponent ({cartCourses}: {cartCourses: CartItem[]}) {

  
const totalAmountCalculationFunction = () => {
  let totalCents = cartCourses
          .reduce((total: any, item: CartItem) => 
              total + item.product.price_cents * item.quantity, 0);
  return totalCents/100
};
  
  return (
    <div id='payment-component'>
      <div className='payment-card'>
        <div className='flex-row'>

          <div className='flex-double'>
            <img src='visa.png'></img>            
          </div>
          <div className='flex-double'>
            <p className="">
              <b>Ruben</b><br />
              <span className="">**** 8880</span>
            </p>
          </div>
        </div>
        <div className='payment-card-due'>
          Amount due: {totalAmountCalculationFunction().toFixed(2)}
        </div>
        <Button variant='outlined' onClick={
          () => { alert('Purchase succesful!'); window.location.reload() }
          }>Pay Now</Button>
      </div>
    </div>
    
  )
}


export default PaymentComponent