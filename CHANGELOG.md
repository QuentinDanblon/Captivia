# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-02

### Features

- Initial public release: web application for pet health management
- Multi-language support (FR, EN, ES, DE, IT, PT)
- Species database with 296+ profiles and 1,379+ breeds
- Notification system with email and push reminders
- Health tracking: vaccinations, medications, vet appointments
- Public sharing of pet profiles (opt-in)
- User account management with GDPR compliance

### Backend

- NestJS with PostgreSQL (Neon)
- JWT authentication with rotating refresh tokens
- Role-based access control (OPERATOR, USER)
- Email service integration (Brevo SMTP)
- Health checks and observability (Sentry)
- Rate limiting and DoS protection

### Frontend

- Next.js 16 with next-intl
- Responsive mobile-first design
- PWA support with offline capability
- Accessibility (WCAG 2.2 AA)
- SEO optimization with server-side rendering

### Infrastructure

- Deployment on Render (API) + Netlify (Frontend) + Neon (Database)
- Automated database backups (age encryption)
- Release automation with release-please
