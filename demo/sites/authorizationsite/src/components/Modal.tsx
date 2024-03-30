import * as React from 'react';
import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import Fade from '@mui/material/Fade';
import { TextField } from '@mui/material';

const style = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 600,
  height: 600,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

const PolicyModal = (props: any) => {
  const [open, setOpen] = React.useState(false);
  const [textfieldValue, setTextfieldValue] = React.useState('');
  const handleOpen = () => setOpen(true);
  const handleClose = () => { 
    setOpen(false) 
  };

  function commitPolicy() {
    handleClose();
    props.addPolicy(textfieldValue);
    setTextfieldValue('')
  }

  return (
    <div id="addPolicy">
      <button id='addPolicyButton' onClick={handleOpen}>Add Policy</button>
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
            <h1>Add policy</h1>
            <TextField 
            value={textfieldValue} 
            onChange={(e) => setTextfieldValue(e.target.value)}
            multiline={true}
            rows={17}
            style={{"width": "100%"}}/>
            <button style={{width: '5em', height: "3em", margin: "2em", marginLeft: 0}} onClick={commitPolicy}>Add</button>
          </Box>
        </Fade>
      </Modal>
    </div>
  );
}

export default PolicyModal;
