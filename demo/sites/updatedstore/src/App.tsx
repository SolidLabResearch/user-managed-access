/** 
 * Demonstrator based on a shopping cart example found at https://www.geeksforgeeks.org/shopping-cart-app-using-react/
 * Modified in function and form to include verification of age
 */

import { useEffect, useState } from 'react';
import './App.css';
import SearchComponent from './components/SearchComponent';
import ShowCourseComponent from './components/ShowCourseComponent';
import PaymentComponent from './components/PaymentComponent';

export const storeBackendUrl = 'http://localhost:5123/'
export const verificationBackendUrl = storeBackendUrl + 'verify'


export type Item = {
    id: number,
    name: string,
    image: string,
    price_cents: number,
    avatar_file_name: string,
    avatar_content_type: string,
    alcoholic: boolean,
}

export type CartItem = {
    product: Item, 
    quantity: number
}

function App() { 
    const [courses, setCourses] = useState<Item[]>([])
    const [cartCourses, setCartCourses] = useState<CartItem[]>([]);
    const [searchCourse, setSearchCourse] = useState('');
    const [ageValidated, setAgeValidated] = useState(false);
    const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {

    async function getData () {
      fetch('zeusbeverages.json'
      ,{
        headers : { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
      )
        .then(function(response){
          return response.json();
        })
        .then(function(items) {
          for (let item of items) {
            item.image = `https://tap.zeus.gent/system/products/avatars/000/000/${item.id.toString().padStart(3, '0')}/medium/${item.avatar_file_name}`
          }
          setCourses(items)
        });
    }

    getData()
    
  }, [])

  // Age verification
  const verify = async (webId: string) => {

    let res;
    try {
      res = await fetch(verificationBackendUrl+`?webid=${encodeURIComponent(webId)}`)
    } catch (e) {
      alert('Store backend is not running!')
      return
    }

    let response = await res.json()
    if (!response.verified) { alert(response.message) }
    else { setAgeValidated(true)}
  }
 
  const addCourseToCartFunction = (GFGcourse: Item) => {
        const alreadyCourses = cartCourses
                            .find(item => item.product.id === GFGcourse.id);
        if (alreadyCourses) {
            const latestCartUpdate = cartCourses.map(item =>
                item.product.id === GFGcourse.id ? { 
                ...item, quantity: item.quantity + 1 } 
                : item
            );
            setCartCourses(latestCartUpdate);
        } else {
            setCartCourses([...cartCourses, {product: GFGcourse, quantity: 1}]);
        }
    };

 
    const deleteCartCourses = (selectedItem: Item) => {
        const updatedCart = cartCourses
                            .filter(item => item.product.id !== selectedItem.id);
        setCartCourses(updatedCart);
    };
 
    const courseSearchUserFunction = (event: any) => {
        setSearchCourse(event.target.value);
    };
 
    const filterCourseFunction = courses.filter((course) =>
        course.name.toLowerCase().includes(searchCourse.toLowerCase())
    );

    const handlePayment = () => {
      setShowPayment(true)
    }

    const calculateBadgeCounter = () => cartCourses.map(e => e.quantity).reduce(add, 0);
    const add = (a: number, b: number) => a + b

    return (        
      <div className="App"> 

        {
          showPayment
          ? <div> 
            <PaymentComponent cartCourses={cartCourses} />
          </div>
          : <div> 
              <SearchComponent searchCourse={searchCourse} 
                              courseSearchUserFunction=
                                 {courseSearchUserFunction}              
                              cartCourses={cartCourses} 
                              setCartCourses={setCartCourses} 
                              deleteCartCourses={deleteCartCourses} 
                              badgeCounter={calculateBadgeCounter()}
                              ageValidated={ageValidated}
                              verify={verify}
                              handlePayment={handlePayment}
                              />
              <main className="App-main">
                <ShowCourseComponent
                    courses={courses}
                    filterCourseFunction={filterCourseFunction}
                    addCourseToCartFunction={addCourseToCartFunction}
                />       
            </main>
          </div>
        }
            
      </div>

    );
}
 
export default App;