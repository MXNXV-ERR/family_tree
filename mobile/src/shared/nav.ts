// Safe back navigation: on a deep-link / refresh the history stack can be empty,
// so a bare router.back() throws "GO_BACK was not handled by any navigator". Fall
// back to Home in that case. Structural router type so it works with useRouter().
type Nav = { canGoBack: () => boolean; back: () => void; replace: (href: any) => void };

export function safeBack(router: Nav) {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}
