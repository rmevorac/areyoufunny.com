export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-8 text-gray-800">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-900">Terms of Service</h1>
      {/* TODO: Update placeholder effective date */}
      <p className="mb-6 text-sm text-gray-600 text-center">
        Effective Date: May 18, 2025
      </p>
      <p className="mb-6 text-lg">
        Welcome to areufunny.com (the "Site"). By accessing or using the Site, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Site.
      </p>

      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900">1. Age Restriction</h2>
          <p className="mb-4 leading-relaxed">
            This Site is intended for users aged 13 and older. By using this Site, you confirm that you are at least 13 years of age. If you are under 18, you represent that you have the permission of a parent or legal guardian to use the Site. We do not knowingly collect personal information from individuals under 13 in compliance with the Children's Online Privacy Protection Act (COPPA).
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900">2. User Content and Licensing</h2>
          <p className="mb-4 leading-relaxed">
            By submitting or uploading any content, including but not limited to audio, video, images, and written material ("User Content"), you grant areufunny.com a non-exclusive, worldwide, royalty-free, perpetual license to use, reproduce, modify, distribute, publicly display, and promote your User Content in connection with the Site and for marketing purposes on any platform or media.
          </p>
          <p className="mb-4 leading-relaxed">
            You retain ownership of your content but agree that we may feature, share, or promote it without additional notice or compensation.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900">3. Prohibited Conduct</h2>
          <p className="mb-2 leading-relaxed">
            You agree not to upload or share content that is:
          </p>
          <ul className="list-disc list-inside mb-4 pl-4 space-y-1 leading-relaxed">
            <li>Illegal, defamatory, or promotes hate speech</li>
            <li>Pornographic or sexually explicit in nature</li>
            <li>Threatening or promotes violence</li>
          </ul>
          <p className="mb-4 leading-relaxed">
            We reserve the right to remove content or restrict access at our sole discretion.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900">4. Limitation of Liability</h2>
          <p className="mb-4 leading-relaxed">
            Use of the Site is at your own risk. Areufunny.com is not responsible for any direct, indirect, or incidental damages resulting from the use or inability to use the Site or any content shared on it.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900">5. Changes to These Terms</h2>
          <p className="mb-4 leading-relaxed">
            We reserve the right to modify these Terms at any time. Continued use of the Site constitutes acceptance of any updated Terms.
          </p>
        </section>
      </div>

      {/* TODO: Update placeholder last updated date */}
      <p className="mt-10 text-sm text-gray-500 text-center">
        Last updated: May 18, 2025
      </p>
    </div>
  );
} 