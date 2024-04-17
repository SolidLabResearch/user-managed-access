//components/SearchComponent.js
import React from 'react';
import TemporaryDrawer from './DrawerComponent';
 
function SearchComponent({ 
    searchCourse, 
    courseSearchUserFunction,
    cartCourses,
    setCartCourses,
    deleteCartCourses,
    badgeCounter,
    ageValidated,
    verify,
}: {
    searchCourse: any, 
    courseSearchUserFunction: any,
    cartCourses: any,
    setCartCourses: any,
    deleteCartCourses: any,
    badgeCounter: number,
    ageValidated: boolean,
    verify: Function,
}) {
    return (
        <header className="App-header">
            <h1>The Drinks Center </h1>
            <div className="search-bar">
                <input
                    type="text"
                    placeholder="Search products..."
                    value={searchCourse}
                    onChange={courseSearchUserFunction}
                />
            </div>

            <TemporaryDrawer 
                cartCourses={cartCourses} 
                setCartCourses={setCartCourses} 
                deleteCartCourses={deleteCartCourses} 
                badgeCounter={badgeCounter}
                ageValidated={ageValidated}
                verify={verify}
            />
        </header>
    );
}
 
export default SearchComponent;