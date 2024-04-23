//components/UserCartComponent.js
 
import React from 'react';
import { getPriceString } from '../util';
import { CartItem } from '../App';
import AuthModal from './AgeVerificationModal';
 
function UserCartComponent({
    cartCourses,
    deleteCartCourses,
    setCartCourses,
    ageValidated,
    verify,
    handlePayment
}: {
    cartCourses: CartItem[], 
    deleteCartCourses: any, 
    setCartCourses: any,
    ageValidated: boolean
    verify: Function,
    handlePayment: Function,
}) {

const totalAmountCalculationFunction = () => {
    let totalCents = cartCourses
            .reduce((total: any, item: CartItem) => 
                total + item.product.price_cents * item.quantity, 0);
    return totalCents/100
};

const getRestrictedItemIds = () => 
    cartCourses.filter((cartItem: CartItem) => 
        cartItem.product.alcoholic).map(cartItem => cartItem.product.id) 
 
console.log('restricted', getRestrictedItemIds(), ageValidated);
return (
<div className={`cart ${cartCourses.length > 0 ? 'active' : ''}`}>
    <h2>My Cart</h2>
    {cartCourses.length === 0 ? (
    <p className="empty-cart">Your cart is empty.</p>
    ) : (
    <div>
    <div className='cart-list-container'>
        <ul>
            {cartCourses.map((item: any) => (
                <li key={item.product.id} className={`cart-item ${
                    item.product.alcoholic && !ageValidated ? 'alcoholic' : ''}`
                }>
                    <div>
                        <div className="item-info">
                            <div className="item-image">
                                <img src={item.product.image} 
                                    alt={item.product.name} />
                            </div>
                            <div className="item-details">
                                <h3>{item.product.name}</h3>
                                <p>Price: €{getPriceString(item.product)}</p>
                            </div>
                        </div>
                        <div>
                            <div className="item-actions">
                                <button
                                    className="remove-button"
                                    onClick={() => 
                                        deleteCartCourses(item.product)}>
                                    Remove Product
                                </button>
                                <div className="quantity">
                                    <button style={{ margin: "1%" }} 
                                        onClick={(e) => {
                                        setCartCourses((prevCartCourses: any) => {
                                            const updatedCart = prevCartCourses.map(
                                            (prevItem: any) =>
                                            prevItem.product.id === item.product.id
                                                    ? { ...prevItem, quantity: 
                                                    item.quantity + 1 }
                                                    : prevItem
                                            );
                                            return updatedCart;
                                        })
                                    }}>+</button>
                                    <p className='quant'>{item.quantity} </p>
                                    <button 
                                        onClick={(e) => {
                                        setCartCourses((prevCartCourses: any) => {
                                            const updatedCart = prevCartCourses.map(
                                            (prevItem: any) =>
                                            prevItem.product.id === item.product.id
                                                    ? { ...prevItem, quantity:
                                                    Math.max(item.quantity - 1, 0) }
                                                    : prevItem
                                            );
                                            return updatedCart;
                                        })
                                    }}>-</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    </div>
</div>
            )}

    {cartCourses.length === 0 ? (<div />) : (
    <div className="checkout-section">
        <div className="checkout-total">
            { 
                getRestrictedItemIds().length && !ageValidated 
                ? 
                    <div>
                        <p style={{color: "red"}}>Age verification is required to purchase alcoholic beverages</p>
                        <AuthModal verify={verify} />
                    </div>
                : 
                    <div>
                        <p className="total">Total Amount: 
                            €{totalAmountCalculationFunction().toFixed(2)}
                        </p>

                        <button id="checkout-button"
                            className="checkout-button"
                            onClick={() => handlePayment()}
                        >
                            Proceed to Payment
                        </button>
                    </div>
            }
        </div>
    </div>)}
</div>
    );
}
 
export default UserCartComponent;