;; Advertiser Verification Contract
;; Validates legitimate marketing entities

(define-data-var contract-owner principal tx-sender)

;; Map to store advertiser information
(define-map advertisers
  principal
  {
    name: (string-utf8 100),
    website: (string-utf8 100),
    verified: bool,
    registration-time: uint
  }
)

;; Public function to register as an advertiser
(define-public (register-advertiser (name (string-utf8 100)) (website (string-utf8 100)))
  (let ((caller tx-sender))
    (asserts! (not (default-to false (get verified (map-get? advertisers caller)))) (err u1))
    (ok (map-set advertisers
      caller
      {
        name: name,
        website: website,
        verified: false,
        registration-time: block-height
      }
    ))
  )
)

;; Admin function to verify an advertiser
(define-public (verify-advertiser (advertiser principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err u2))
    (asserts! (is-some (map-get? advertisers advertiser)) (err u3))
    (ok (map-set advertisers
      advertiser
      (merge (unwrap-panic (map-get? advertisers advertiser)) { verified: true })
    ))
  )
)

;; Public function to check if an advertiser is verified
(define-read-only (is-verified-advertiser (advertiser principal))
  (default-to false (get verified (map-get? advertisers advertiser)))
)

;; Public function to get advertiser details
(define-read-only (get-advertiser-details (advertiser principal))
  (map-get? advertisers advertiser)
)

;; Function to transfer ownership
(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err u4))
    (ok (var-set contract-owner new-owner))
  )
)
