import { IonApp, setupIonicReact } from '@ionic/react';
import Home from './pages/Home';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

setupIonicReact();

const App = () => (
  <IonApp>
    <Home />
  </IonApp>
);

export default App;
