import { useEffect, useState } from 'react';
import './App.css';
import { Grid } from '@mui/material';
import Banner from './Banner';
import { processAgeResult, retrieveData } from './flow';

type Item = {
  id: number,
  name: string,
  image: string,
  price_cents: number,
  avatar_file_name: string,
  avatar_content_type: string,
  alcoholic: boolean,
}

function App() {

  const [items, setItems] = useState([] as Item[])
  const [verified, setVerified] = useState(false)
  const [modalError, setModalError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

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
          setItems(items)
        });
    }

    getData()
    
  }, [])

  function clearErrors() {
    setModalError('')
  }
  

  function displayItem(item: Item) {
    return (
      <Grid xs={4}>
        <img src={item.image} alt='product'></img>
        <p>{item.name}</p>
        <p>{item.price_cents}</p>
      </Grid>
    )
  }


  const verify = async function (webId: string) {
    console.log('running verification for', webId)

    try {
      const ageData = await retrieveData(webId);
      const result = await processAgeResult(ageData, webId)
      if (result) setVerified(true)

    } catch (error: any) {
      setModalError(error.message)
    }
  }

  return (
    <div className="App" style={{"height": "100vh"}}>
      <header>
        <div style={{"width": "100%"}}>
          <h3 style={{"margin": "0px"}}>De Buurtwinkel</h3>
        </div>
      </header>

      <nav id='navBar' >
        <div id='navBarContainer'>
          <div id='logoContainer'>
            <img id='logo' src='store.jpg' alt='Store logo' />
          </div>
          <div id='searchBarContainer'>
            <input id='searchBar' placeholder='What are you looking for?' value={searchTerm} onChange={
              (e) => setSearchTerm(e.target.value)
            }></input>
          </div>
        </div>
      </nav>

      <div style={{"width": "100%", "height": "90vh"}}>

      <h2>Dranken</h2>
      <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 3 }} >
        {
          items.filter(item => { 
            if (item.alcoholic && !verified) return false;
            if (searchTerm && (!item.name || !item.name.toLowerCase().includes(searchTerm.toLowerCase()))) return false
            return true
            //return verified ? true : !item.alcoholic
          }).map(item => displayItem(item))
        }
      </Grid>
      </div>

      {
        !verified && <Banner verify={verify} error={modalError} clearErrors={clearErrors}></Banner>
      }
      
    </div>
  );
}

export default App;
