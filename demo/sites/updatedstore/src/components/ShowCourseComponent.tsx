//components/ShowCourseComponent.js
import { Box, Grid } from '@mui/material';
import React from 'react';
import { CartItem, Item } from '../App';
import { getPriceString } from '../util';



function ShowCourseComponent({ 
    courses, 
    cartCourses,
    filterCourseFunction, 
    addCourseToCartFunction,
    deleteCartCourses, 
    setCartCourses,
}: {
    courses: any, 
    cartCourses: CartItem[],
    filterCourseFunction: any, 
    addCourseToCartFunction: any 
    deleteCartCourses: Function, 
    setCartCourses: Function,
}) {
    return (
        <div className="product-list">
            {/* <h2>GRID</h2> */}
            <Box sx={{ flexGrow: 1 }}>
                <Grid className='product-grid' container spacing={2} direction="row" alignItems="stretch">
                    {filterCourseFunction.length === 0 ? (
                        <Grid item xs={12}>
                            <p>No matching Product found.</p>
                        </Grid>
                    ) : (
                        filterCourseFunction.map((product: Item) => (

                            <Grid item xs={12} sm={4} key={product.id}>
                                <div className='product'>
                                    <img src={product.image} alt={product.name} />
                                    <h2>{product.name}</h2>
                                    <p>Price: €{getPriceString(product)}</p>
                                    <CartItemOptions 
                                        item={product} 
                                        cartItems={cartCourses} 
                                        addCourseToCartFunction={addCourseToCartFunction}
                                        deleteCartCourses={deleteCartCourses}
                                        setCartCourses={setCartCourses}
                                    />
                                </div>
                            </Grid>
                            
                        ))
                    )}
                </Grid>
            </Box>
            
        </div>
    );
}
 
export default ShowCourseComponent;


export function CartItemOptions ( 
    {
        item, 
        cartItems,
        addCourseToCartFunction,
        deleteCartCourses,
        setCartCourses,
    } : {
        item: Item,
        cartItems: CartItem[],
        addCourseToCartFunction: Function,
        deleteCartCourses: Function, 
        setCartCourses: Function,
    } 
) {
    const filteredCartItems = 
        cartItems.filter((cartItem: CartItem) => cartItem.product.id === item.id)
    const foundCartItem = filteredCartItems.length === 1 ? filteredCartItems[0] : undefined
    
    return (
        foundCartItem
        ? (
            <div className="item-actions">
                <div className="quantity">
                    <button 
                        className='cart-edit-count-button'
                        onClick={(e) => {
                        setCartCourses((prevCartCourses: CartItem[]) => {
                            const updatedCart = prevCartCourses.map(
                            (prevItem: any) =>
                            prevItem.product.id === foundCartItem.product.id
                                    ? { ...prevItem, quantity:
                                    Math.max(foundCartItem.quantity - 1, 0) }
                                    : prevItem
                            );
                            return updatedCart.filter(ci => ci.quantity !== 0);
                        })
                    }}>-</button>
                    <p className='quant'>{foundCartItem.quantity} </p>
                    <button 
                        className='cart-edit-count-button'
                        onClick={(e) => {
                        setCartCourses((prevCartCourses: CartItem[]) => {
                            const updatedCart = prevCartCourses.map(
                            (prevItem: any) =>
                            prevItem.product.id === foundCartItem.product.id
                                    ? { ...prevItem, quantity: 
                                        foundCartItem.quantity + 1 }
                                    : prevItem
                            );
                            return updatedCart.filter(ci => ci.quantity !== 0);
                        })
                    }}>+</button>
                </div>
            </div>
        )
        : (
            <button
                className="add-to-cart-button"
                onClick={() => addCourseToCartFunction(item)}
            >
                Add to Shopping Cart
            </button>
        )
    )

}