;; Publisher Verification Contract
;; Validates legitimate media platforms

(define-data-var contract-owner principal tx-sender)

;; Map to store publisher information
(define-map publishers
  principal
  {
    name: (string-utf8 100),
    website: (string-utf8 100),
    category: (string-utf8 50),
    verified: bool,
    registration-time: uint
  }
)

;; Public function to register as a publisher
(define-public (register-publisher (name (string-utf8 100)) (website (string-utf8 100)) (category (string-utf8 50)))
  (let ((caller tx-sender))
    (asserts! (not (default-to false (get verified (map-get? publishers caller)))) (err u1))
    (ok (map-set publishers
      caller
      {
        name: name,
        website: website,
        category: category,
        verified: false,
        registration-time: block-height
      }
    ))
  )
)

;; Admin function to verify a publisher
(define-public (verify-publisher (publisher principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err u2))
    (asserts! (is-some (map-get? publishers publisher)) (err u3))
    (ok (map-set publishers
      publisher
      (merge (unwrap-panic (map-get? publishers publisher)) { verified: true })
    ))
  )
)

;; Public function to check if a publisher is verified
(define-read-only (is-verified-publisher (publisher principal))
  (default-to false (get verified (map-get? publishers publisher)))
)

;; Public function to get publisher details
(define-read-only (get-publisher-details (publisher principal))
  (map-get? publishers publisher)
)

;; Function to transfer ownership
(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err u4))
    (ok (var-set contract-owner new-owner))
  )
)
