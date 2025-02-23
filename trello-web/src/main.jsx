// import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import CssBaseline from '@mui/material/CssBaseline'
import GlobalStyles from '@mui/material/GlobalStyles'
import { Experimental_CssVarsProvider as CssVarProvider } from '@mui/material/styles'
import theme from './theme.js'

// Cấu hình React-Toastify
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

// Cấu hình MUI Dialog
import { ConfirmProvider } from 'material-ui-confirm'

// Cấu hình Redux Store
import { Provider } from 'react-redux'
import { store } from '~/redux/store.js'

// Cấu hình react-router-dom với BrowerRouter
import { BrowserRouter } from 'react-router-dom'

// Cấu hình Redux-Persist
import { PersistGate } from 'redux-persist/integration/react'
import { persistStore } from 'redux-persist'
const persistor = persistStore(store)

// Giải pháp Inject store: là kỹ thuật khi cần sử dụng biến redux store ở các file
//  ngoài phạm vi react component
import { injectStore } from '~/utils/authorizeAxios'
// Truyền store từ redux sang cho file utils/authorizeAxios.js để có thể sử dụng được store
injectStore(store)

ReactDOM.createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <PersistGate persistor={persistor}>
      <BrowserRouter basename='/'>
        <CssVarProvider theme={theme}>
          <ConfirmProvider defaultOptions={{
            buttonOrder: ['confirm', 'cancel'],
            allowClose: false,
            dialogProps: { maxWidth: 'xs' },
            cancellationButtonProps: { color: 'primary' },
            confirmationButtonProps: { color: 'success', variant: 'outlined' }
          }}>
            {/* Chỉnh sửa style chung cho tất cả thẻ a */}
            <GlobalStyles styles={{ a: { textDecoration: 'none' } }} />
            <CssBaseline />
            <App />
            <ToastContainer theme='colored' autoClose={3000}/>
          </ConfirmProvider>
        </CssVarProvider>
      </BrowserRouter>
    </PersistGate>
  </Provider>
)
