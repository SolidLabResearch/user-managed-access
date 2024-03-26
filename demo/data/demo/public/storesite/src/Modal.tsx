import * as React from 'react';
import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import Fade from '@mui/material/Fade';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

const style = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

const AuthModal = (props: any) => {
  const [open, setOpen] = React.useState(false);
  const [showInput, setShowInput] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const handleOpen = () => setOpen(true);
  const handleClose = () => { 
    setOpen(false) 
    props.clearErrors();
    setShowInput(false)
  };

  return (
    <div>
      <button id='ageValidation' onClick={handleOpen}>Verify</button>
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
            { props.error 
            ? <Typography id="transition-modal-title" variant="h6" component="h2" style={{color: "red"}}>
                  { `Could not verify age: ${props.error}` }
              </Typography>
            : 
              showInput

              ? <div >
                  <input placeholder='webid' value={inputValue} onChange={(evt) => setInputValue(evt.target.value)} style={{width: "70%", marginRight: "10px"}}></input>
                  <button onClick={() => props.verify(inputValue)}>Verify</button>
              </div>

              :<div id="webIdButton" onClick={() => setShowInput(true)}><button>
              <Typography id="transition-modal-title" variant="h6" component="h2">
                  Verify using WebID
              </Typography>
              </button></div>
          
          }
          </Box>
        </Fade>
      </Modal>
    </div>
  );
}

export default AuthModal;