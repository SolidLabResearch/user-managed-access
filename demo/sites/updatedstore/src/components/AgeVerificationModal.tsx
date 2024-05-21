import * as React from 'react';
import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import Fade from '@mui/material/Fade';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button'
import { Card } from '@mui/material';

const style = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 500,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

const rubenprofileurl = 'http://localhost:3000/ruben/profile/card#me'

const AuthModal = (props: any) => {
  const [open, setOpen] = React.useState(false);
  const [showInput, setShowInput] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(''); // todo: fix this
  const handleOpen = () => setOpen(true);
  const handleClose = () => { 
    setOpen(false) 
    setShowInput(false)
  };

  return (
    <div>
      <button id='ageValidation' className="verification-button" onClick={handleOpen}>Age Verification</button>
      {/* <Button onClick={handleOpen}>Open modal</Button> */}
      <Modal
        aria-labelledby="transition-modal-title"
        aria-describedby="transition-modal-description"
        open={open}
        onClose={handleClose}
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{
          backdrop: {
            timeout: 500,
          },
        }}
      >
        <Fade in={open}>
          <Box sx={style}>
            <Typography id="transition-modal-title" variant="h6" component="h2">
                Select WebID
            </Typography>
            <Typography id="transition-modal-title" variant="subtitle2" component="h2">
                The store will negotiate your age data with your data space for the purpose of age verification.
            </Typography>
            <br />
            { props.error 
            ? <Typography id="transition-modal-title" variant="h6" component="h2" style={{color: "red"}}>
                { `Could not verify age: ${props.error}` }
              </Typography>
            : 
              showInput

              ? <div className='webid-options-container'>
                <Button className='webid-option' variant='outlined' onClick={
                    () => props.verify(rubenprofileurl)}>Continue as Ruben <img src='./profile.png' style={{
                      height: "3em",
                      width: "3em",
                      borderRadius: "1.5em",
                      marginLeft: "1em",
                    }} /></Button>
                {/* <Card onClick={() => props.verify(rubenprofileurl)} style={{width: "90%", padding: "1em"}}>
                  <img src='./profile.png' style={{
                      height: "3em",
                      width: "3em",
                      borderRadius: "50%"
                    }} />
                    <Typography>
                      Ruben Verborgh
                    </Typography>
                </Card>     */}
                <TextField className='webid-option' id="outlined-basic" label="New WebID" 
                    variant="outlined" placeholder='WebID' value={inputValue} onChange={
                    (evt) => setInputValue(evt.target.value)
                  } onKeyUp={(e) => {
                    if (e.key === 'Enter' || e.keyCode === 13) {
                        props.verify(inputValue)
                    }}}/>
              </div>

              :<div className='verification-option-container'>
                {/* <div className='verification-option' onClick={() => alert('Not implemented!')}>
                    <img className='auth-logo' src='itsme.png' />
                    <Typography id="transition-modal-title" variant="h6" component="h2">
                        ItsMe
                    </Typography>
                </div> */}
                <div className='verification-option' onClick={() => setShowInput(true)}>
                    <img className='auth-logo' src='solid.png' />
                    <Typography id="transition-modal-title" variant="h6" component="h2">
                        WebID
                    </Typography>
                </div>
              </div>
          
          }
          </Box>
        </Fade>
      </Modal>
    </div>
  );
}

export default AuthModal;
