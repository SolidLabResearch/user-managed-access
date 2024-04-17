//components/ShowCourseComponent.js
import { Box, Grid } from '@mui/material';
import React from 'react';
import { Item } from '../App';
import { getPriceString } from '../util';



function ShowCourseComponent({ 
    courses, 
    filterCourseFunction, 
    addCourseToCartFunction 
}: {
    courses: any, 
    filterCourseFunction: any, 
    addCourseToCartFunction: any 
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
                                    <button
                                        className="add-to-cart-button"
                                        onClick={() => addCourseToCartFunction(product)}
                                    >
                                        Add to Shopping Cart
                                    </button>
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