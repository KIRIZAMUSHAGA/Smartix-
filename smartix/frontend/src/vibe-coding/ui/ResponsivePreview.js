import React, { useState } from 'react';
import DeviceSelector, { devices } from './DeviceSelector';
import '../debugger/debugger.css';

const ResponsivePreview = ({ previewUrl }) => {
  const [selectedDevice, setSelectedDevice] = useState(devices[0]);
  const [rotate, setRotate] = useState(false);

  const isDesktop = selectedDevice.name === 'Desktop';
  const deviceStyle = {
    width: isDesktop ? '100%' : rotate ? selectedDevice.height : selectedDevice.width,
    height: isDesktop ? '100%' : rotate ? selectedDevice.width : selectedDevice.height,
    transition: 'all 0.3s ease',
    border: isDesktop ? 'none' : '1px solid #333',
    borderRadius: isDesktop ? 0 : '20px',
    overflow: 'hidden',
    margin: '0 auto',
  };

  return (
    <div className="responsive-preview">
      <DeviceSelector
        selectedDevice={selectedDevice}
        onSelect={setSelectedDevice}
        rotate={rotate}
        onRotate={() => setRotate(!rotate)}
      />

      <div className="device-stage">
        <div className="device-frame" style={deviceStyle}>
          <iframe
            src={previewUrl}
            title="Preview"
            className="preview-iframe"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      </div>
    </div>
  );
};

export default ResponsivePreview;